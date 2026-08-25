import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import Turntable from "../components/Turntable.jsx";

const GUESS_WINDOW_DEFAULT = 12000;

export default function PlayerGame() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const socket = getSocket();

  const [name] = useState(state?.name || "");
  const [roomCode] = useState(state?.roomCode || "");
  const [phase, setPhase] = useState("lobby"); // lobby | starting | guessing | reveal | ended
  const [players, setPlayers] = useState([]);
  const [roundInfo, setRoundInfo] = useState(null); // {roundNumber, totalRounds}
  const [guess, setGuess] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trackChoices] = useState(state?.trackChoices || []);
  const [feedback, setFeedback] = useState(null); // {correct, points} | null
  const [reveal, setReveal] = useState(null); // {track, players, isLastRound}
  const [timeLeftPct, setTimeLeftPct] = useState(100);
  const [error, setError] = useState("");

  const timerRef = useRef(null);

  useEffect(() => {
    if (!roomCode || !name) {
      navigate("/join");
      return;
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
    }

    socket.on("room:players-updated", onPlayersUpdated);
    socket.on("room:host-disconnected", onHostDisconnected);
    socket.on("round:starting", onRoundStarting);
    socket.on("round:guessing-open", onGuessingOpen);
    socket.on("round:reveal", onReveal);
    socket.on("game:ended", onGameEnded);

    return () => {
      socket.off("room:players-updated", onPlayersUpdated);
      socket.off("room:host-disconnected", onHostDisconnected);
      socket.off("round:starting", onRoundStarting);
      socket.off("round:guessing-open", onGuessingOpen);
      socket.off("round:reveal", onReveal);
      socket.off("game:ended", onGameEnded);
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="screen">
      <div className="brand">
        <span className="brand-mark" style={{ fontSize: "1.8rem" }}>
          NEEDLE DROP
        </span>
      </div>
      <div className="badge" style={{ marginBottom: 24 }}>
        Room {roomCode} · {name}
      </div>

      {error && (
        <div className="card">
          <p className="error-text">{error}</p>
        </div>
      )}

      {!error && phase === "lobby" && (
        <div className="card" style={{ textAlign: "center" }}>
          <Turntable size={150} />
          <h3 className="section-title">You're in!</h3>
          <p className="hint">Waiting for the host to start the game…</p>
        </div>
      )}

      {!error && phase === "starting" && roundInfo && (
        <div className="card" style={{ textAlign: "center" }}>
          <Turntable spinning size={150} />
          <h3 className="section-title">
            Round {roundInfo.roundNumber} / {roundInfo.totalRounds}
          </h3>
          <p className="hint">Listen up — the host is about to drop the needle.</p>
        </div>
      )}

      {!error && phase === "guessing" && roundInfo && (
        <div className="card">
          <h3 className="section-title" style={{ textAlign: "center" }}>
            Round {roundInfo.roundNumber} / {roundInfo.totalRounds}
          </h3>
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
              className="btn btn-primary btn-block"
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
      )}

      {!error && phase === "reveal" && reveal && (
        <div className="card">
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
          <Leaderboard players={sortedPlayers} />
          <p className="center-note">
            {reveal.isLastRound
              ? "That was the last round — waiting for host…"
              : "Waiting for the host to start the next round…"}
          </p>
        </div>
      )}

      {!error && phase === "ended" && (
        <div className="card">
          <h3 className="section-title" style={{ textAlign: "center" }}>
            Final scores
          </h3>
          <Leaderboard players={sortedPlayers} />
        </div>
      )}
    </div>
  );
}

function Leaderboard({ players }) {
  return (
    <ul className="player-list">
      {players.map((p, i) => (
        <li key={p.id} className="player-row">
          <span>
            <span className="rank">#{i + 1}</span>
            {p.name}
            {!p.connected && " (left)"}
          </span>
          <span className="score">{p.score}</span>
        </li>
      ))}
    </ul>
  );
}