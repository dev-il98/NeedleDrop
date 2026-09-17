import "./game-ui.css";

/**
 * stats: [{ label, value, tone }] — tone is "neon" | "amber" | "violet" | undefined
 * Only renders stats that were actually passed — never fabricates data.
 */
export default function GameHUD({ stats }) {
  if (!stats || stats.length === 0) return null;
  return (
    <div className="game-hud">
      {stats.map((s, i) => (
        <div key={i} className={`hud-stat${s.tone ? ` hud-stat--${s.tone}` : ""}`}>
          <div className="hud-stat-label">{s.label}</div>
          <div className="hud-stat-value">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
