export default function Waveform({ state = "idle", bars = 7 }) {
  return (
    <div
      className={`waveform waveform--${state}`}
      aria-hidden="true"
    >
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className="waveform-bar"
        />
      ))}
    </div>
  );
}