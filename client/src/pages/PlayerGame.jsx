import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { api, captureSidFromUrl } from "../lib/api";
import { createHostPlayer } from "../lib/spotifyPlayer";
import { savePlayerSession, loadPlayerSession } from "../lib/playerSession";
import GameHUD from "../components/GameHUD";
import Turntable from "../components/Turntable";
import Waveform from "../components/Waveform";
import AmbientParticles from "../components/AmbientParticles";
import PlayerTile from "../components/PlayerTile";
import "../components/game-ui.css";

const GUESS_WINDOW_DEFAULT = 12000;

function logSpotify(info) {
  // [ND SPOTIFY] safe diagnostic — never logs tokens or secrets.
  console.log("[ND SPOTIFY]", info);
}

function StudioHeader({ roomCode, name }) {
  return (
    <div className="studio-header studio-enter">
      <div className="studio-logo">
        <span className="mark" />
        NEEDLE DROP
      </div>
      <div className="studio-eyebrow">
        Room {roomCode} · {name}
      </div>
    </div>
  );
}

export default function PlayerGame() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const socket = getSocket();
  const playerRef = useRef(null);
  const deviceIdRef = useRef(null);
  const timerRef = useRef(null);

  // If we're landing back here after the full-page Spotify OAuth redirect,
  // React Router's location.state is gone — fall back to what Join.jsx
  // saved in this tab's sessionStorage right before we left.
  const restored = useMemo(() => {
    if (state?.roomCode && state?.name) return state;
    return loadPlayerSession() || {};
  }, [state]);

  const [name] = useState(restored.name || "");
  const [roomCode] = useState(restored.roomCode || "");
  const [playerId] = useState(restored.playerId || "");
  const [trackChoices] = useState(restored.trackChoices || []);

  const [phase, setPhase] = useState("lobby"); // lobby | starting | guessing | reveal | ended
  const [players, setPlayers] = useState([]);
  const [roundInfo, setRoundInfo] = useState(null);
  const [guess, setGuess] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [timeLeftPct, setTimeLeftPct] = useState(100);
  const [error, setError] = useState("");

  // ---------- Remote per-player Spotify playback ----------
  // Every player can optionally connect their OWN Spotify account so the
  // round plays on their OWN device — independent of the host's device and
  // of every other player's. Guessing still works if they skip this.
  const [spotifyConnected, setSpotifyConnected] = useState(null); // null = checking
  const [spotifyPhase, setSpotifyPhase] = useState("idle");
  // idle | connecting | ready | needs_activation | playing | paused | complete
  const [spotifyError, setSpotifyError] = useState("");

  // Keep this tab's join details around so a return trip from Spotify's
  // login page (a full page navigation) can restore this exact session.
  useEffect(() => {
    captureSidFromUrl();
    if (roomCode && name) {
      savePlayerSession({ name, roomCode, playerId, trackChoices });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check THIS player's own Spotify connection — entirely independent of
  // whatever session the host (or any other player) has in their own tab.
  useEffect(() => {
    api
      .authStatus()
      .then((res) => setSpotifyConnected(res.connected))
      .catch(() => setSpotifyConnected(false));
  }, []);

  // Once connected, spin up this player's own Web Playback SDK device.
  useEffect(() => {
    if (!spotifyConnected) return;
    let cancelled = false;
    setSpotifyPhase("connecting");

    createHostPlayer({
      deviceName: `Needle Drop — ${name || "Player"}`,
      onReady: (deviceId) => {
        if (cancelled) return;
        deviceIdRef.current = deviceId;
        setSpotifyPhase((p) => (p === "needs_activation" ? p : "ready"));
        logSpotify({ player: name, event: "ready", status: "ok" });
        socket.emit("player:spotify-ready", { deviceId });
      },
      onError: (msg) => {
        if (cancelled) return;
        setSpotifyError(msg);
        logSpotify({ player: name, event: "error", status: msg });
      },
      onAutoplayFailed: () => {
        if (cancelled) return;
        setSpotifyPhase("needs_activation");
        logSpotify({ player: name, event: "autoplay_failed", status: "blocked" });
      },
    })
      .then((player) => {
        if (cancelled) return;
        playerRef.current = player;
      })
      .catch((err) => {
        if (cancelled) return;
        setSpotifyError(err.message || "Failed to load Spotify player.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyConnected]);

  // Browsers block audio until a real user gesture unlocks it — this button
  // is that gesture, called once before the first round if needed.
  function activateSpotify() {
    const player = playerRef.current;
    if (!player) return;
    player.activateElement?.();
    setSpotifyPhase("ready");
    logSpotify({ player: name, event: "activated", status: "ok" });
  }

  // ---------- Game socket wiring ----------
  useEffect(() => {
    if (!roomCode || !name) {
      navigate("/join");
      return;
    }

    function onConnect() {
      // Reclaim our spot after any reconnect (phone screen lock, app
      // switch, spotty signal) so we keep receiving round updates.
      socket.emit("player:join-room", { code: roomCode, name, playerId });
    }
    function onPlayersUpdated(list) {
      setPlayers(list);
    }
    function onHostDisconnected() {
      setError("The host disconnected. This game has ended.");
      setPhase("ended");
    }
    function onRoundStarting(info) {
      setRoundInfo(info);
      setPhase("starting");
      setFeedback(null);
      setGuess("");
    }
    function onPlayTrack(payload) {
      // Remote mode: this player's own device plays the track using this
      // player's own Spotify session — never the host's or another
      // player's device.
      playOnOwnDevice(payload.trackUri, payload.snippetMs);
    }
    function onGuessingOpen(info) {
      setRoundInfo(info);
      setPhase("guessing");
      startTimer(info.guessWindowMs || GUESS_WINDOW_DEFAULT);
    }
    function onReveal(payload) {
      clearTimer();
      setReveal(payload);
      setPlayers(payload.players);
      setPhase("reveal");
    }
    function onGameEnded(payload) {
      clearTimer();
      setPlayers(payload.players);
      setPhase("ended");
      setSpotifyPhase((p) => (p === "playing" || p === "paused" ? "complete" : p));
    }

    socket.on("connect", onConnect);
    socket.on("room:players-updated", onPlayersUpdated);
    socket.on("room:host-disconnected", onHostDisconnected);
    socket.on("round:starting", onRoundStarting);
    socket.on("round:play-track", onPlayTrack);
    socket.on("round:guessing-open", onGuessingOpen);
    socket.on("round:reveal", onReveal);
    socket.on("game:ended", onGameEnded);

    return () => {
      socket.off("connect", onConnect);
      socket.off("room:players-updated", onPlayersUpdated);
      socket.off("room:host-disconnected", onHostDisconnected);
      socket.off("round:starting", onRoundStarting);
      socket.off("round:play-track", onPlayTrack);
      socket.off("round:guessing-open", onGuessingOpen);
      socket.off("round:reveal", onReveal);
      socket.off("game:ended", onGameEnded);
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function playOnOwnDevice(trackUri, snippetMs) {
    const deviceId = deviceIdRef.current;
    if (!deviceId) {
      // No Spotify connected on this device — guessing still works, just
      // without audio on this particular player's screen.
      logSpotify({ player: name, event: "round:play-track", status: "no_device" });
      return;
    }
    try {
      setSpotifyPhase("playing");
      const { accessToken } = await api.getToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [trackUri] }),
      });
      logSpotify({ player: name, event: "round:play-track", status: "playing", trackUri: "(set)" });

      setTimeout(async () => {
        try {
          const { accessToken: freshToken } = await api.getToken();
          await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${freshToken}` },
          });
        } catch (err) {
          setSpotifyError("Couldn't pause playback: " + err.message);
        }
        setSpotifyPhase("paused");
      }, snippetMs || 1000);
    } catch (err) {
      setSpotifyError("Couldn't play the track: " + err.message);
      logSpotify({ player: name, event: "round:play-track", status: "error: " + err.message });
    }
  }

  function startTimer(durationMs) {
    setTimeLeftPct(100);
    const start = Date.now();
    clearTimer();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setTimeLeftPct(pct);
      if (pct <= 0) clearTimer();
    }, 100);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function submitGuess(e) {
    e.preventDefault();
    if (!guess.trim() || feedback?.correct) return;
    setShowSuggestions(false);
    socket.emit("player:submit-guess", { guess: guess.trim() }, (res) => {
      if (!res.ok) return;
      setFeedback({ correct: res.correct, points: res.points });
    });
  }

  function selectSuggestion(name) {
    setGuess(name);
    setShowSuggestions(false);
  }

  const suggestions = useMemo(() => {
    const q = guess.trim().toLowerCase();
    if (q.length < 2) return [];
    return trackChoices
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [guess, trackChoices]);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const myRank = sortedPlayers.findIndex((p) => p.id === playerId) + 1;
  const myScore = sortedPlayers.find((p) => p.id === playerId)?.score ?? 0;

  const violetGhostBtn = {
    borderColor: "rgba(185, 138, 245, 0.5)",
    color: "var(--studio-violet)",
  };

  function SpotifyPanel() {
    if (spotifyConnected === false) {
      return (
        <>
          <a
            href={api.loginUrl("/play")}
            className="console-btn console-btn--ghost console-btn--block"
            style={{ marginTop: 16, ...violetGhostBtn }}
          >
            Connect Spotify
          </a>
          <p className="hint" style={{ marginTop: 8 }}>
            Optional — you can still guess without it, but connecting lets
            the round play on your own device.
          </p>
        </>
      );
    }
    if (spotifyPhase === "needs_activation") {
      return (
        <button
          onClick={activateSpotify}
          className="console-btn console-btn--ghost console-btn--block"
          style={{ marginTop: 16, ...violetGhostBtn }}
        >
          Activate Spotify
        </button>
      );
    }
    if (spotifyConnected && spotifyPhase === "connecting") {
      return <p className="hint" style={{ marginTop: 12 }}>Connecting Spotify…</p>;
    }
    if (spotifyConnected && spotifyPhase === "ready") {
      return (
        <p className="hint" style={{ marginTop: 12 }}>
          Spotify ready — the round will play on this device.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="studio studio--player">
      <div className="studio-bg" />
      <AmbientParticles />
      <div className="studio-content">
        <StudioHeader roomCode={roomCode} name={name} />

        {error && (
          <div className="neon-panel neon-panel--glow-violet">
            <p className="error-text">{error}</p>
          </div>
        )}

        {!error && phase === "lobby" && (
          <div className="neon-panel neon-panel--glow-violet" style={{ textAlign: "center" }}>
            <Turntable variant="player" spinning={false} />
            <h3 className="section-title">You're in!</h3>
            <p className="hint">Waiting for the host to start the game…</p>
            <SpotifyPanel />
            {spotifyError && <p className="error-text">{spotifyError}</p>}
          </div>
        )}

        {!error && phase === "starting" && roundInfo && (
          <>
            <GameHUD
              stats={[
                { label: "Round", value: `${roundInfo.roundNumber}/${roundInfo.totalRounds}`, tone: "violet" },
                { label: "Rank", value: myRank ? `#${myRank}` : "—", tone: "violet" },
                { label: "Score", value: myScore, tone: "violet" },
              ]}
            />
            <div className="neon-panel neon-panel--glow-violet" style={{ textAlign: "center" }}>
              <Turntable variant="player" spinning={spotifyPhase === "playing"} />
              <Waveform state={spotifyPhase === "playing" ? "listening" : "listening"} />
              <h3 className="section-title">
                Round {roundInfo.roundNumber} / {roundInfo.totalRounds}
              </h3>
              <p className="hint">Listen up — the host is about to drop the needle.</p>
              {spotifyPhase === "needs_activation" && (
                <button
                  onClick={activateSpotify}
                  className="console-btn console-btn--ghost console-btn--block"
                  style={{ marginTop: 16, ...violetGhostBtn }}
                >
                  Activate Spotify
                </button>
              )}
              {spotifyConnected === false && (
                <p className="hint" style={{ marginTop: 12 }}>
                  Connect Spotify to hear the round.
                </p>
              )}
              {spotifyError && <p className="error-text">{spotifyError}</p>}
            </div>
          </>
        )}

        {!error && phase === "guessing" && roundInfo && (
          <>
            <GameHUD
              stats={[
                { label: "Round", value: `${roundInfo.roundNumber}/${roundInfo.totalRounds}`, tone: "violet" },
                { label: "Rank", value: myRank ? `#${myRank}` : "—", tone: "violet" },
                { label: "Score", value: myScore, tone: "violet" },
              ]}
            />
            <div className="neon-panel neon-panel--glow-violet">
              <Waveform state="guessing" />
              <div className="timer-bar">
                <div className="timer-bar-fill" style={{ width: `${timeLeftPct}%` }} />
              </div>
              <form onSubmit={submitGuess} autoComplete="off">
                <label htmlFor="guess">What's the song?</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="guess"
                    type="text"
                    value={guess}
                    onChange={(e) => {
                      setGuess(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="Start typing a song title…"
                    disabled={feedback?.correct}
                    autoFocus
                    style={{ marginBottom: showSuggestions && suggestions.length ? 4 : 14 }}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      className="card"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        padding: 6,
                        marginBottom: 14,
                      }}
                    >
                      {suggestions.map((t) => (
                        <div
                          key={t.id}
                          className="track-row"
                          onMouseDown={() => selectSuggestion(t.name)}
                        >
                          {t.image && <img src={t.image} alt="" />}
                          <div className="meta">
                            <div className="name">{t.name}</div>
                            <div className="artist">{t.artists}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {(!showSuggestions || suggestions.length === 0) && <div style={{ marginBottom: 14 }} />}
                <button
                  className="console-btn console-btn--ghost console-btn--block"
                  style={violetGhostBtn}
                  disabled={feedback?.correct || !guess.trim()}
                >
                  Submit guess
                </button>
              </form>
              {feedback && (
                <p
                  className="center-note"
                  style={{ color: feedback.correct ? "#3fb8af" : "#e0554f" }}
                >
                  {feedback.correct
                    ? `Correct! +${feedback.points} points`
                    : "Not quite — try again"}
                </p>
              )}
            </div>
          </>
        )}

        {!error && phase === "reveal" && reveal && (
          <>
            <GameHUD
              stats={[
                { label: "Round", value: `${reveal.roundNumber}/${reveal.totalRounds}`, tone: "violet" },
                { label: "Rank", value: myRank ? `#${myRank}` : "—", tone: "violet" },
                { label: "Score", value: myScore, tone: "violet" },
              ]}
            />
            <div className="neon-panel neon-panel--glow-violet">
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
                {reveal.track.image && (
                  <img
                    src={reveal.track.image}
                    alt=""
                    style={{ width: 64, height: 64, borderRadius: 8 }}
                  />
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
              <p className="center-note">
                {reveal.isLastRound
                  ? "That was the last round — waiting for host…"
                  : "Waiting for the host to start the next round…"}
              </p>
            </div>
          </>
        )}

        {!error && phase === "ended" && (
          <div className="neon-panel neon-panel--glow-violet" style={{ textAlign: "center" }}>
            <Turntable variant="player" stopping />
            <h3 className="section-title">Final scores</h3>
            <div className="player-tiles" style={{ textAlign: "left" }}>
              {sortedPlayers.map((p, i) => (
                <PlayerTile key={p.id} player={p} rank={i + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
