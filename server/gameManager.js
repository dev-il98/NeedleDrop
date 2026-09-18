import { isCorrectGuess } from "./matcher.js";
import { randomUUID } from "crypto";

const GUESS_WINDOW_MS = 12_000; // how long players have to answer per round
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars

// rooms: code -> room object (see shape below, kept in memory)
const rooms = new Map();

function makeRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function clampSnippetMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1000;
  return Math.min(15000, Math.max(500, Math.round(n)));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    connected: p.connected,
    spotifyReady: !!p.spotifyReady,
  }));
}

function currentRoundPublicInfo(room) {
  if (!room.currentRound) return null;
  return {
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
    snippetMs: room.currentRound.snippetMs,
  };
}

// Sent to players so they can search/autocomplete guesses. Only names and
// artists — never which track is currently playing.
function trackChoices(room) {
  return room.tracks.map((t) => ({
    id: t.id,
    name: t.name,
    artists: t.artists,
    image: t.image,
  }));
}

// [ND SPOTIFY] safe diagnostic logger — never logs tokens/secrets.
function logSpotify(info) {
  console.log("[ND SPOTIFY]", JSON.stringify(info));
}

export function registerGameHandlers(io, socket) {
  // ---------- HOST: create room ----------
  socket.on("host:create-room", ({ mode, tracks, totalRounds, snippetMs }, ack) => {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return ack?.({ ok: false, error: "No tracks provided." });
    }
    const code = makeRoomCode();
    const room = {
      code,
      hostSocketId: socket.id,
      hostDisconnectTimer: null,
      mode: mode === "remote" ? "remote" : "local",
      tracks: shuffle(tracks),
      trackIndex: 0,
      totalRounds: Math.min(totalRounds || tracks.length, tracks.length),
      roundNumber: 0,
      snippetMs: clampSnippetMs(snippetMs),
      players: new Map(),
      status: "lobby",
      currentRound: null,
      guessTimer: null,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = "host";
    ack?.({ ok: true, roomCode: code });
  });

  // ---------- PLAYER: join room (also used to rejoin after a reconnect) ----------
  socket.on("player:join-room", ({ code, name, playerId }, ack) => {
    const room = rooms.get((code || "").toUpperCase());
    if (!room) return ack?.({ ok: false, error: "Room not found." });
    if (room.status === "ended")
      return ack?.({ ok: false, error: "This game has already ended." });

    // A returning player (socket reconnected, e.g. phone locked briefly)
    // sends back the same playerId we gave them, so they reclaim their
    // existing score instead of joining as a brand-new player.
    const existing = playerId ? room.players.get(playerId) : null;
    const effectiveId = existing ? playerId : randomUUID();

    if (existing) {
      existing.socketId = socket.id;
      existing.connected = true;
      if (name && name.trim()) existing.name = name.trim().slice(0, 20);
    } else {
      const trimmedName = (name || "Player").trim().slice(0, 20) || "Player";
      room.players.set(effectiveId, {
        id: effectiveId,
        socketId: socket.id,
        name: trimmedName,
        score: 0,
        connected: true,
        spotifyReady: false,
        deviceId: null,
      });
    }

    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = "player";
    socket.data.playerId = effectiveId;

    ack?.({
      ok: true,
      roomCode: room.code,
      mode: room.mode,
      status: room.status,
      playerId: effectiveId,
      players: publicPlayers(room),
      trackChoices: trackChoices(room),
    });

    io.to(room.code).emit("room:players-updated", publicPlayers(room));
  });

  // ---------- PLAYER: their own Spotify Web Playback SDK is ready ----------
  // NEW: part of remote per-player playback. The device ID never leaves this
  // player's own browser/server pairing — it's only used so THIS player's
  // client can target its own device when told to play a track. The server
  // never uses it to control anyone else's playback.
  socket.on("player:spotify-ready", ({ deviceId }, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "player") return ack?.({ ok: false });
    const player = room.players.get(socket.data.playerId);
    if (!player) return ack?.({ ok: false });

    player.deviceId = deviceId || null;
    player.spotifyReady = !!deviceId;
    logSpotify({
      player: player.name,
      deviceId: deviceId ? "(set)" : null,
      event: "player:spotify-ready",
      status: player.spotifyReady ? "ready" : "cleared",
    });

    io.to(room.code).emit("room:players-updated", publicPlayers(room));
    ack?.({ ok: true });
  });

  // ---------- HOST: start game / advance rounds ----------
  socket.on("host:start-game", (_payload, ack) => {
    const room = getHostRoom(socket);
    if (!room) return ack?.({ ok: false, error: "Room not found." });
    room.status = "playing";
    startNextRound(io, room);
    ack?.({ ok: true });
  });

  socket.on("host:next-round", (_payload, ack) => {
    const room = getHostRoom(socket);
    if (!room) return ack?.({ ok: false, error: "Room not found." });
    clearGuessTimer(room);
    startNextRound(io, room);
    ack?.({ ok: true });
  });

  // Host's browser has played the snippet + auto-paused; open guessing.
  // (Local mode only — remote mode opens guessing on a server timer instead,
  // since there's no single host device to report back.)
  socket.on("host:snippet-played", (_payload, ack) => {
    const room = getHostRoom(socket);
    if (!room || !room.currentRound) return ack?.({ ok: false });
    openGuessing(io, room);
    ack?.({ ok: true });
  });

  socket.on("host:reveal-now", (_payload, ack) => {
    const room = getHostRoom(socket);
    if (!room) return ack?.({ ok: false });
    revealRound(io, room);
    ack?.({ ok: true });
  });

  // ---------- PLAYER: submit a guess ----------
  socket.on("player:submit-guess", ({ guess }, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.currentRound || room.status !== "guessing") {
      return ack?.({ ok: false, error: "No active round to guess on." });
    }
    const playerId = socket.data.playerId;
    const round = room.currentRound;
    if (round.correctGuessers.has(playerId)) {
      return ack?.({ ok: false, error: "You already guessed correctly." });
    }

    const correct = isCorrectGuess(guess, round.track.name);
    if (correct) {
      const elapsedMs = Date.now() - round.guessingOpenedAt;
      const points = Math.round(
        scoreForElapsed(elapsedMs) * difficultyMultiplier(round.snippetMs)
      );
      round.correctGuessers.add(playerId);
      const player = room.players.get(playerId);
      if (player) player.score += points;

      io.to(room.code).emit("room:players-updated", publicPlayers(room));
      ack?.({ ok: true, correct: true, points });

      // If everyone's guessed, reveal early.
      const connectedPlayers = [...room.players.values()].filter((p) => p.connected);
      if (round.correctGuessers.size >= connectedPlayers.length) {
        revealRound(io, room);
      }
    } else {
      ack?.({ ok: true, correct: false });
    }
  });

  // Lets the host's browser reclaim its room after a brief disconnect (e.g.
  // switching tabs can momentarily drop the socket) instead of losing the
  // room entirely.
  socket.on("host:rejoin-room", ({ roomCode }, ack) => {
    const room = rooms.get((roomCode || "").toUpperCase());
    if (!room) return ack?.({ ok: false, error: "Room not found." });

    if (room.hostDisconnectTimer) {
      clearTimeout(room.hostDisconnectTimer);
      room.hostDisconnectTimer = null;
    }
    room.hostSocketId = socket.id;
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.role = "host";
    ack?.({ ok: true, status: room.status, players: publicPlayers(room) });
  });

  // ---------- Disconnect handling ----------
  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    if (socket.data.role === "host" && room.hostSocketId === socket.id) {
      room.hostSocketId = null;
      room.hostDisconnectTimer = setTimeout(() => {
        if (!room.hostSocketId) {
          io.to(code).emit("room:host-disconnected");
          clearGuessTimer(room);
          clearRoundTimer(room);
          rooms.delete(code);
        }
      }, 30_000);
    } else if (socket.data.role === "player" && room.players.has(socket.data.playerId)) {
      const player = room.players.get(socket.data.playerId);
      if (player.socketId === socket.id) {
        player.connected = false;
        io.to(code).emit("room:players-updated", publicPlayers(room));
      }
    }
  });
}

function getHostRoom(socket) {
  const room = rooms.get(socket.data.roomCode);
  if (!room || room.hostSocketId !== socket.id) return null;
  return room;
}

function clearGuessTimer(room) {
  if (room.guessTimer) {
    clearTimeout(room.guessTimer);
    room.guessTimer = null;
  }
}

function clearRoundTimer(room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
}

function scoreForElapsed(elapsedMs) {
  const seconds = elapsedMs / 1000;
  return Math.max(100, Math.round(1000 - seconds * 75));
}

function difficultyMultiplier(snippetMs) {
  if (snippetMs <= 1000) return 2.0;
  if (snippetMs <= 2000) return 1.5;
  if (snippetMs <= 3000) return 1.2;
  if (snippetMs <= 5000) return 1.0;
  return 0.7;
}

function startNextRound(io, room) {
  if (room.trackIndex >= room.tracks.length || room.roundNumber >= room.totalRounds) {
    endGame(io, room);
    return;
  }

  const track = room.tracks[room.trackIndex];
  room.trackIndex += 1;
  room.roundNumber += 1;
  room.status = "round-active";
  room.currentRound = {
    track,
    snippetMs: room.snippetMs,
    guessingOpenedAt: null,
    correctGuessers: new Set(),
  };

  // Host always gets the track (needs the URI to play it locally too, and
  // to show "now playing" in the control room UI either way).
  io.to(room.hostSocketId).emit("round:prepare", {
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
    track,
    snippetMs: room.currentRound.snippetMs,
  });

  // Players just get "round starting", no title/artist leaked.
  io.to(room.code).except(room.hostSocketId).emit("round:starting", {
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
  });

  if (room.mode === "remote") {
    // NEW: remote per-player playback. Each ready player's own browser uses
    // its own Spotify session + device to play this track — the server
    // never touches anyone's access token, only relays the track URI (which
    // is an opaque ID, not a spoiler) and a snippet length.
    io.to(room.code).except(room.hostSocketId).emit("round:play-track", {
      trackUri: track.uri,
      roundNumber: room.roundNumber,
      totalRounds: room.totalRounds,
      snippetMs: room.currentRound.snippetMs,
    });

    // No single host device to report "snippet finished" in remote mode, so
    // the server itself opens guessing after the snippet duration elapses.
    clearRoundTimer(room);
    room.roundTimer = setTimeout(() => {
      openGuessing(io, room);
    }, room.currentRound.snippetMs);
  }
}

function openGuessing(io, room) {
  if (!room.currentRound || room.status === "guessing") return;
  clearRoundTimer(room);

  room.status = "guessing";
  room.currentRound.guessingOpenedAt = Date.now();

  io.to(room.code).emit("round:guessing-open", {
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
    snippetMs: room.currentRound.snippetMs,
    guessWindowMs: GUESS_WINDOW_MS,
  });

  clearGuessTimer(room);
  room.guessTimer = setTimeout(() => {
    revealRound(io, room);
  }, GUESS_WINDOW_MS);
}

function revealRound(io, room) {
  if (!room.currentRound) return;
  clearGuessTimer(room);
  clearRoundTimer(room);
  room.status = "reveal";
  const round = room.currentRound;

  io.to(room.code).emit("round:reveal", {
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
    track: {
      name: round.track.name,
      artists: round.track.artists,
      image: round.track.image,
    },
    players: publicPlayers(room),
    isLastRound: room.roundNumber >= room.totalRounds || room.trackIndex >= room.tracks.length,
  });
}

function endGame(io, room) {
  room.status = "ended";
  room.currentRound = null;
  io.to(room.code).emit("game:ended", { players: publicPlayers(room) });
}
