import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, captureSidFromUrl } from "../lib/api";
import { getSocket } from "../lib/socket";
import { createHostPlayer } from "../lib/spotifyPlayer";
import GameHUD from "../components/GameHUD";
import Turntable from "../components/Turntable";
import Waveform from "../components/Waveform";
import AmbientParticles from "../components/AmbientParticles";
import PlayerTile from "../components/PlayerTile";
import "../components/game-ui.css";

const ROUND_OPTIONS = [5, 10, 15, 20, 25, 30];
const SNIPPET_OPTIONS = [
  { seconds: 1, multiplier: "2.0x", label: "1 second — brutal" },
  { seconds: 2, multiplier: "1.5x", label: "2 seconds — hard" },
  { seconds: 3, multiplier: "1.2x", label: "3 seconds — medium" },
  { seconds: 5, multiplier: "1.0x", label: "5 seconds — easy" },
  { seconds: 10, multiplier: "0.7x", label: "10 seconds — very easy" },
];

function StudioHeader({ subtitle }) {
  return (
    <div className="studio-header studio-enter">
      <div className="studio-logo">
        <span className="mark" />
        NEEDLE DROP
      </div>
      <div className="studio-eyebrow">{subtitle}</div>
    </div>
  );
}

export default function Host() {
  const [params] = useSearchParams();
  const socket = getSocket();
  const deviceIdRef = useRef(null);

  const [connected, setConnected] = useState(null);
  const [connectError, setConnectError] = useState(params.get("error") || "");

  const [playlists, setPlaylists] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [tracks, setTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const [mode, setMode] = useState("local");
  const [totalRounds, setTotalRounds] = useState(10);
  const [snippetSeconds, setSnippetSeconds] = useState(1);

  const [deviceReady, setDeviceReady] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const [phase, setPhase] = useState("setup");
  const [roomCode, setRoomCode] = useState("");
  const roomCodeRef = useRef("");
  const [players, setPlayers] = useState([]);
  const [round, setRound] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [isPlayingSnippet, setIsPlayingSnippet] = useState(false);
  const [justCorrectIds, setJustCorrectIds] = useState([]);

  useEffect(() => {
    captureSidFromUrl();
    api
      .authStatus()
      .then((res) => setConnected(res.connected))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    createHostPlayer({
      onReady: (deviceId) => {
        if (cancelled) return;
        deviceIdRef.current = deviceId;
        setDeviceReady(true);
      },
      onError: (msg) => setPlayerError(msg),
    }).catch((err) => setPlayerError(err.message || "Failed to load Spotify player."));
    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    api
      .getPlaylists()
      .then((res) => setPlaylists(res.playlists))
      .catch((err) => setConnectError(err.message));
  }, [connected]);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    function onConnect() {
      if (roomCodeRef.current) {
        socket.emit("host:rejoin-room", { roomCode: roomCodeRef.current });
      }
    }
    function onPlayersUpdated(list) {
      setPlayers((prev) => {
        const prevScores = new Map(prev.map((p) => [p.id, p.score]));
        const flashed = list
          .filter((p) => prevScores.has(p.id) && p.score > prevScores.get(p.id))
          .map((p) => p.id);
        if (flashed.length) {
          setJustCorrectIds(flashed);
          setTimeout(() => setJustCorrectIds([]), 900);
        }
        return list;
      });
    }
    function onRoundPrepare(payload) {
      setRound(payload);
      setPhase("round-active");
      setReveal(null);
      playSnippet(payload.track, payload.snippetMs);
    }
    function onGuessingOpen(info) {
      setPhase("guessing");
      setRound((r) => (r ? { ...r, ...info } : info));
    }
    function onReveal(payload) {
      setReveal(payload);
      setPlayers(payload.players);
      setPhase("reveal");
    }
    function onGameEnded(payload) {
      setPlayers(payload.players);
      setPhase("ended");
    }

    socket.on("connect", onConnect);
    socket.on("room:players-updated", onPlayersUpdated);
    socket.on("round:prepare", onRoundPrepare);
    socket.on("round:guessing-open", onGuessingOpen);
    socket.on("round:reveal", onReveal);
    socket.on("game:ended", onGameEnded);

    return () => {
      socket.off("connect", onConnect);
      socket.off("room:players-updated", onPlayersUpdated);
      socket.off("round:prepare", onRoundPrepare);
      socket.off("round:guessing-open", onGuessingOpen);
      socket.off("round:reveal", onReveal);
      socket.off("game:ended", onGameEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectPlaylist(id) {
    setSelectedId(id);
    setTracks([]);
    setLoadingTracks(true);
    try {
      const res =
        id === "liked" ? await api.getLikedSongsTracks() : await api.getPlaylistTracks(id);
      setTracks(res.tracks);
      setTotalRounds(Math.min(10, res.tracks.length || 10));
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setLoadingTracks(false);
    }
  }

  function createRoom() {
    socket.emit(
      "host:create-room",
      { mode, tracks, totalRounds, snippetMs: snippetSeconds * 1000 },
      (res) => {
        if (!res.ok) {
          setConnectError(res.error);
          return;
        }
        setRoomCode(res.roomCode);
        setPhase("lobby");
      }
    );
  }

  function startGame() {
    socket.emit("host:start-game");
  }

  function nextRound() {
    socket.emit("host:next-round");
  }

  function revealNow() {
    socket.emit("host:reveal-now");
  }

  async function playSnippet(track, snippetMs) {
    const deviceId = deviceIdRef.current;
    if (!deviceId) {
      setPlayerError("Playback device isn't ready yet — give it a second and try again.");
      return;
    }
    try {
      setIsPlayingSnippet(true);
      const { accessToken } = await api.getToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [track.uri] }),
      });

      setTimeout(async () => {
        try {
          const { accessToken: freshToken } = await api.getToken();
          await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${freshToken}` },
          });
        } catch (err) {
          setPlayerError("Couldn't pause playback: " + err.message);
        }
        setIsPlayingSnippet(false);
        socket.emit("host:snippet-played");
      }, snippetMs || 1000);
    } catch (err) {
      setIsPlayingSnippet(false);
      setPlayerError("Couldn't play the track: " + err.message);
    }
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // ---------- Render ----------

  if (connected === null) {
    return (
      <div className="studio studio--host">
        <div className="studio-bg" />
        <div className="studio-content" style={{ paddingTop: 120, textAlign: "center" }}>
          <p className="hint">Checking Spotify connection…</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="studio studio--host">
        <div className="studio-bg" />
        <AmbientParticles />
        <div className="studio-content">
          <StudioHeader subtitle="Control room" />
          <div className="neon-panel neon-panel--glow-amber studio-enter studio-enter--1" style={{ textAlign: "center" }}>
            <Turntable variant="host" spinning={false} />
            <h1 className="section-title">Host Control</h1>
            <p className="subtitle" style={{ margin: "0 auto 24px" }}>
              Connect your Spotify account to pull in playlists and control
              playback. You'll need Spotify Premium — snippet playback uses
              the Web Playback SDK, which is Premium-only.
            </p>
            <a href={api.loginUrl()} className="console-btn console-btn--amber console-btn--block">
              Connect Spotify
            </a>
            {connectError && <p className="error-text">{connectError}</p>}
          </div>
          <Link to="/" className="hint" style={{ marginTop: 24, display: "inline-block" }}>
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="studio studio--host">
        <div className="studio-bg" />
        <AmbientParticles />
        <div className="studio-content">
          <StudioHeader subtitle="Control room" />

          <div className="neon-panel neon-panel--glow-amber studio-enter studio-enter--1">
            <label>Playlist</label>
            <select value={selectedId} onChange={(e) => selectPlaylist(e.target.value)}>
              <option value="" disabled>
                Choose a playlist…
              </option>
              <option value="liked">Liked Songs</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.trackCount})
                </option>
              ))}
            </select>

            {loadingTracks && <p className="hint" style={{ marginTop: 12 }}>Loading tracks…</p>}
            {!loadingTracks && tracks.length > 0 && (
              <p className="hint" style={{ marginTop: 12 }}>
                {tracks.length} playable tracks loaded.
              </p>
            )}

            <div style={{ marginTop: 20 }}>
              <label>Rounds</label>
              <select
                value={totalRounds}
                onChange={(e) => setTotalRounds(Number(e.target.value))}
              >
                {ROUND_OPTIONS.filter((n) => n <= (tracks.length || 999)).map((n) => (
                  <option key={n} value={n}>
                    {n} rounds
                  </option>
                ))}
                {tracks.length > 0 && (
                  <option value={tracks.length}>All {tracks.length} tracks</option>
                )}
              </select>
            </div>

            <div style={{ marginTop: 20 }}>
              <label>Snippet length</label>
              <select
                value={snippetSeconds}
                onChange={(e) => setSnippetSeconds(Number(e.target.value))}
              >
                {SNIPPET_OPTIONS.map((opt) => (
                  <option key={opt.seconds} value={opt.seconds}>
                    {opt.label} · {opt.multiplier} points
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 20 }}>
              <label>Where should the song play?</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="local">Out loud from this device (everyone's together)</option>
                <option value="remote">Players are remote (v2 — best effort for now)</option>
              </select>
            </div>

            <button
              className="console-btn console-btn--amber console-btn--block"
              style={{ marginTop: 24 }}
              disabled={!tracks.length || !deviceReady}
              onClick={createRoom}
            >
              {deviceReady ? "Create room" : "Connecting to Spotify player…"}
            </button>
            {playerError && <p className="error-text">{playerError}</p>}
            {connectError && <p className="error-text">{connectError}</p>}
          </div>

          <Link to="/" className="hint" style={{ marginTop: 20, display: "inline-block" }}>
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="studio studio--host">
        <div className="studio-bg" />
        <AmbientParticles />
        <div className="studio-content">
          <StudioHeader subtitle="Control room" />

          <GameHUD
            stats={[
              { label: "Room", value: roomCode, tone: "amber" },
              { label: "Players", value: players.length, tone: "amber" },
              { label: "Status", value: "Lobby", tone: "amber" },
            ]}
          />

          <div className="neon-panel neon-panel--glow-amber" style={{ textAlign: "center" }}>
            <div className="room-code-label">Room code</div>
            <div className="room-code-display">{roomCode}</div>
            <p className="hint">Have players go to the join page and enter this code.</p>

            <h4 className="section-title" style={{ marginTop: 24, textAlign: "left" }}>
              Players
            </h4>
            {players.length === 0 ? (
              <p className="hint" style={{ textAlign: "left" }}>Waiting for players to join…</p>
            ) : (
              <div className="player-tiles" style={{ textAlign: "left" }}>
                {players.map((p) => (
                  <PlayerTile key={p.id} player={p} />
                ))}
              </div>
            )}

            <button
              className="console-btn console-btn--amber console-btn--block"
              style={{ marginTop: 24 }}
              disabled={players.length === 0}
              onClick={startGame}
            >
              Start game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "round-active" || phase === "guessing") {
    return (
      <div className="studio studio--host">
        <div className="studio-bg" />
        <AmbientParticles />
        <div className="studio-content">
          <StudioHeader subtitle="Control room" />

          <GameHUD
            stats={[
              { label: "Room", value: roomCode, tone: "amber" },
              { label: "Round", value: `${round?.roundNumber}/${round?.totalRounds}`, tone: "amber" },
              { label: "Status", value: isPlayingSnippet ? "Listening" : "Guessing", tone: "amber" },
            ]}
          />

          <div className="neon-panel neon-panel--glow-amber" style={{ textAlign: "center" }}>
            <Turntable variant="host" spinning={isPlayingSnippet} />
            <Waveform state={isPlayingSnippet ? "listening" : "guessing"} />
            <h3 className="section-title">
              {isPlayingSnippet ? "Playing snippet…" : "Guessing is open"}
            </h3>
            <p className="hint">
              {isPlayingSnippet
                ? "Everyone's listening for the drop."
                : "Players are guessing on their own devices."}
            </p>

            <h4 className="section-title" style={{ marginTop: 24, textAlign: "left" }}>
              Live scores
            </h4>
            <div className="player-tiles" style={{ textAlign: "left" }}>
              {sortedPlayers.map((p, i) => (
                <PlayerTile
                  key={p.id}
                  player={p}
                  rank={i + 1}
                  flash={justCorrectIds.includes(p.id)}
                />
              ))}
            </div>

            {phase === "guessing" && (
              <button
                className="console-btn console-btn--ghost console-btn--block"
                style={{ marginTop: 20 }}
                onClick={revealNow}
              >
                Reveal answer now
              </button>
            )}
            {playerError && <p className="error-text">{playerError}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "reveal" && reveal) {
    return (
      <div className="studio studio--host">
        <div className="studio-bg" />
        <AmbientParticles />
        <div className="studio-content">
          <StudioHeader subtitle="Control room" />

          <GameHUD
            stats={[
              { label: "Room", value: roomCode, tone: "amber" },
              { label: "Round", value: `${reveal.roundNumber}/${reveal.totalRounds}`, tone: "amber" },
            ]}
          />

          <div className="neon-panel neon-panel--glow-amber">
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
              {reveal.track.image && (
                <img src={reveal.track.image} alt="" style={{ width: 64, height: 64, borderRadius: 8 }} />
              )}
              <div>
                <div style={{ fontWeight: 700 }}>{reveal.track.name}</div>
                <div className="hint">{reveal.track.artists}</div>
              </div>
            </div>
            <h4 className="section-title">Leaderboard</h4>
            <div className="player-tiles">
              {sortedPlayers.map((p, i) => (
                <PlayerTile key={p.id} player={p} rank={i + 1} />
              ))}
            </div>
            <button
              className="console-btn console-btn--amber console-btn--block"
              style={{ marginTop: 20 }}
              onClick={nextRound}
            >
              {reveal.isLastRound ? "See final scores" : "Next round"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="studio studio--host">
        <div className="studio-bg" />
        <AmbientParticles />
        <div className="studio-content">
          <StudioHeader subtitle="End of set" />
          <div className="neon-panel neon-panel--glow-amber" style={{ textAlign: "center" }}>
            <Turntable variant="host" stopping />
            <h3 className="section-title" style={{ textAlign: "center" }}>
              Final scores
            </h3>
            <div className="player-tiles" style={{ textAlign: "left" }}>
              {sortedPlayers.map((p, i) => (
                <PlayerTile key={p.id} player={p} rank={i + 1} />
              ))}
            </div>
          </div>
          <Link to="/" className="hint" style={{ marginTop: 20, display: "inline-block" }}>
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
