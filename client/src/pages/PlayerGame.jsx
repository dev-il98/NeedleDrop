import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSocket } from "../lib/socket";
import Turntable from "../components/Turntable.jsx";
import GameHUD from "../components/GameHUD.jsx";
import Visualizer from "../components/Visualizer.jsx";
import RadialTimer from "../components/RadialTimer.jsx";
import ConnectionBadge from "../components/ConnectionBadge.jsx";

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
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [trackChoices] = useState(state?.trackChoices || []);
  const [feedback, setFeedback] = useState(null); // {correct, points} | null
  const [wrongPulse, setWrongPulse] = useState(false);
  const [reveal, setReveal] = useState(null); // {track, players, isLastRound}
  const [timeLeftPct, setTimeLeftPct] = useState(100);
  const [guessWindowMs, setGuessWindowMs] = useState(GUESS_WINDOW_DEFAULT);
  const [error, setError] = useState("");
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);

  const timerRef = useRef(null);
  // Tracks whether THIS player got the current round right, from the
  // server's own ack — reset each round, read when the round is revealed.
  // Streak/accuracy are derived from real server responses, not guessed.
  const gotItThisRoundRef = useRef(false);

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
      gotItThisRoundRef.current = false;
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
      setStreak((s) => (gotItThisRoundRef.current ? s + 1 : 0));
      setRoundsPlayed((n) => n + 1);
      if (gotItThisRoundRef.current) setCorrectCount((c) => c + 1);
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
    setGuessWindowMs(durationMs);
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
    e?.preventDefault();
    if (!guess.trim() || feedback?.correct) return;
    setShowSuggestions(false);
    socket.emit("player:submit-guess", { guess: guess.trim() }, (res) => {
      if (!res.ok) return;
      setFeedback({ correct: res.correct, points: res.points });
      if (res.correct) {
        gotItThisRoundRef.current = true;
      } else {
        setWrongPulse(true);
        setTimeout(() => setWrongPulse(false), 500);
      }
    });
  }

  function selectSuggestion(name) {
    setGuess(name);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  }

  const suggestions = useMemo(() => {
    const q = guess.trim().toLowerCase();
    if (q.length < 2) return [];
    return trackChoices
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [guess, trackChoices]);

  useEffect(() => {
    setActiveSuggestion(-1);
  }, [suggestions.length, guess]);

  function onInputKeyDown(e) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion].name);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const ownScore = useMemo(
    () => players.find((p) => p.id === socket.id)?.score ?? 0,
    [players, socket.id]
  );

  const visualizerState =
    phase === "starting"
      ? "listening"
      : phase === "guessing"
      ? "guessing"
      : phase === "reveal"
      ? gotItThisRoundRef.current
        ? "correct"
        : "wrong"
      : "idle";

  return (
    <div className="screen">
      {phase !== "lobby" && phase !== "ended" && <ConnectionBadge socket={socket} />}
      <div className="hero-eyebrow">Needle Drop</div>
      {!error && phase !== "lobby" && (
        <GameHUD
          roomCode={roomCode}
          roundNumber={roundInfo?.roundNumber}
          totalRounds={roundInfo?.totalRounds}
          score={ownScore}
          streak={streak}
        />
      )}
      {(error || phase === "lobby") && (
        <div className="badge" style={{ marginBottom: 24 }}>
          Room {roomCode} · {name}
        </div>
      )}

      {error && (
        <div className="card">
          <p className="error-text">{error}</p>
        </div>
      )}

      {!error && phase === "lobby" && (
        <div className="card phase-blur-enter" style={{ textAlign: "center" }}>
          <Turntable size={150} />
          <h3 className="section-title">You're in!</h3>
          <p className="hint waiting-dots">Waiting for the host to start</p>
        </div>
      )}

      {!error && phase === "starting" && roundInfo && (
        <div className="card phase-blur-enter" style={{ textAlign: "center" }}>
          <Turntable spinning size={150} />
          <Visualizer state={visualizerState} />
          <h3 className="section-title">Listening…</h3>
          <p className="hint">The host is about to drop the needle.</p>
        </div>
      )}

      {!error && phase === "guessing" && roundInfo && (
        <>
          <div className="turntable-timer-stage" style={{ marginBottom: 8 }}>
            <Turntable size={120} />
            <RadialTimer
              pct={timeLeftPct}
              seconds={Math.ceil((timeLeftPct / 100) * (guessWindowMs / 1000))}
            />
          </div>
          <div className={`card phase-blur-enter${wrongPulse ? " shake" : ""}`}>
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
                  onKeyDown={onInputKeyDown}
                  placeholder="Start typing a song title…"
                  disabled={feedback?.correct}
                  autoFocus
                  role="combobox"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-controls="player-suggestions"
                  style={{ marginBottom: showSuggestions && suggestions.length ? 4 : 14 }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestion-panel" id="player-suggestions" role="listbox">
                    {suggestions.map((t, i) => (
                      <div
                        key={t.id}
                        role="option"
                        aria-selected={i === activeSuggestion}
                        className={`track-row cursor-target${i === activeSuggestion ? " is-active" : ""}`}
                        onMouseDown={() => selectSuggestion(t.name)}
                        onMouseEnter={() => setActiveSuggestion(i)}
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
                className="btn btn-primary btn-block cursor-target"
                disabled={feedback?.correct || !guess.trim()}
              >
                Submit guess
              </button>
            </form>
            {feedback && (
              <p
                className="center-note"
                style={{ color: feedback.correct ? "var(--lime)" : "var(--coral)", fontWeight: 700 }}
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
        <div className="card phase-blur-enter">
          <div className={`feedback-flash show-${gotItThisRoundRef.current ? "correct" : "wrong"}`} />
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
            {reveal.track.image && (
              <img
                src={reveal.track.image}
                alt=""
                style={{ width: 64, height: 64, borderRadius: 3 }}
              />
            )}
            <div>
              <div style={{ fontWeight: 700 }}>{reveal.track.name}</div>
              <div className="hint">{reveal.track.artists}</div>
            </div>
          </div>
          <h4 className="section-title">Leaderboard</h4>
          <Leaderboard players={sortedPlayers} ownId={socket.id} />
          <p className="center-note waiting-dots">
            {reveal.isLastRound ? "That was the last round — waiting for host" : "Waiting for the host"}
          </p>
        </div>
      )}

      {!error && phase === "ended" && (
        <div className="card phase-blur-enter">
          <h3 className="section-title" style={{ textAlign: "center" }}>
            Final scores
          </h3>
          {roundsPlayed > 0 && (
            <div className="result-stats">
              <span>
                <strong>{correctCount}</strong>/{roundsPlayed} correct
              </span>
              <span>
                <strong>{Math.round((correctCount / roundsPlayed) * 100)}%</strong> accuracy
              </span>
            </div>
          )}
          <Leaderboard players={sortedPlayers} ownId={socket.id} />
        </div>
      )}
    </div>
  );
}

function Leaderboard({ players, ownId }) {
  return (
    <ul className="player-list">
      {players.map((p, i) => (
        <li
          key={p.id}
          className={`player-row${i === 0 ? " is-leader" : ""}`}
          style={p.id === ownId ? { borderColor: "var(--lime-dim)" } : undefined}
        >
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