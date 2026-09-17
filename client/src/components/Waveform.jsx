import "./game-ui.css";

const BAR_COUNT = 7;

/**
 * state: "idle" | "listening" | "guessing" | "correct" | "wrong" | "next"
 * We don't have access to real audio data (Spotify's SDK doesn't expose it),
 * so this is a state-driven visual, not a real analyzer.
 */
export default function Waveform({ state = "idle" }) {
  const modifier =
    state === "listening" || state === "guessing"
      ? "waveform--listening"
      : state === "correct"
      ? "waveform--correct"
      : state === "wrong"
      ? "waveform--wrong"
      : "";
  return (
    <div className={`waveform ${modifier}`} aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span key={i} className="waveform-bar" />
      ))}
    </div>
  );
}
