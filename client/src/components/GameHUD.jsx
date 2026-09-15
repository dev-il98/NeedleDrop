import { useEffect, useRef, useState } from "react";

// Shared top bar for gameplay screens. Each value bumps briefly when it
// actually changes, so increments feel real rather than just re-rendering.
// Any of roundNumber/score/streak/roomCode can be omitted — only the
// blocks for values that are provided get rendered.
export default function GameHUD({ roundNumber, totalRounds, score, streak, roomCode }) {
  const [scoreBump, setScoreBump] = useState(false);
  const [streakBump, setStreakBump] = useState(false);
  const prevScore = useRef(score);
  const prevStreak = useRef(streak);

  useEffect(() => {
    if (score != null && score !== prevScore.current) {
      prevScore.current = score;
      setScoreBump(true);
      const t = setTimeout(() => setScoreBump(false), 400);
      return () => clearTimeout(t);
    }
  }, [score]);

  useEffect(() => {
    if (streak != null && streak !== prevStreak.current) {
      prevStreak.current = streak;
      setStreakBump(true);
      const t = setTimeout(() => setStreakBump(false), 400);
      return () => clearTimeout(t);
    }
  }, [streak]);

  return (
    <div className="hud">
      {roomCode != null && (
        <div className="hud-block">
          <span className="hud-label">Room</span>
          <span className="hud-value">{roomCode}</span>
        </div>
      )}

      {score != null && (
        <div className="hud-block">
          <span className="hud-label">Score</span>
          <span className={`hud-value is-lime${scoreBump ? " bump" : ""}`}>{score}</span>
        </div>
      )}

      {roundNumber != null && (
        <div className="hud-block" style={{ alignItems: "center" }}>
          <span className="hud-label">Round</span>
          <span className="hud-value">
            {roundNumber}/{totalRounds}
          </span>
        </div>
      )}

      {streak != null && (
        <div className="hud-block" style={{ alignItems: "flex-end" }}>
          <span className="hud-label">Streak</span>
          <span
            className={`streak-chip${streak >= 2 ? " is-hot" : ""}${streakBump ? " bump" : ""}`}
          >
            {streak >= 2 ? "🔥" : "—"} {streak}
          </span>
        </div>
      )}
    </div>
  );
}