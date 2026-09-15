import "../game-ui.css";

/**
 * variant: "solo" | "host" | "join" | "player" — controls accent color
 * spinning: bool — whether the disc + tonearm are in "playing" position
 * stopping: bool — plays a one-time "slowing down" animation (results screen)
 */
export default function Turntable({ variant = "solo", spinning = false, stopping = false }) {
  const discClass = stopping ? "stopping" : spinning ? "spinning" : "";
  return (
    <div className={`turntable turntable--${variant}`}>
      <div className={`turntable-disc${discClass ? ` ${discClass}` : ""}`} />
      <div className={`tonearm${spinning ? " active" : ""}`} />
    </div>
  );
}