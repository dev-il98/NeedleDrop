// Circular countdown ring, meant to wrap around the Turntable during the
// guessing phase. `pct` is 0-100 (time remaining). Shows a numeric seconds
// readout too — a ring alone isn't precise enough to "immediately
// understand how much time remains", so the number carries that job.
const SIZE = 220;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RadialTimer({ pct = 100, seconds = null }) {
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, pct)) / 100);

  return (
    <div className="radial-timer" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--lime)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="radial-timer-arc"
        />
      </svg>
      {seconds != null && (
        <div className="radial-timer-readout" aria-live="polite">
          {seconds}s
        </div>
      )}
    </div>
  );
}