import "./studio.css";

export default function StudioWaveform({ state = "idle" }) {
  return (
    <div
      className={`studio-waveform studio-waveform--${state}`}
      aria-hidden="true"
    >
      {Array.from({ length: 25 }, (_, i) => (
        <span
          key={i}
          style={{
            "--delay": `${(i % 7) * 0.08}s`,
            "--height": `${20 + ((i * 17) % 70)}%`,
          }}
        />
      ))}
    </div>
  );
}