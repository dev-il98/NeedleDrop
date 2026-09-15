// Decorative visualizer bars, driven by known game state.
//
// States: "idle" | "ready" | "listening" | "guessing" | "correct" | "wrong"
//
// Intentionally NOT wired to real frequency-analysis data. Spotify's Web
// Playback SDK plays audio through a DRM-protected path with no exposed
// audio signal, so there is no legitimate source of live FFT data here.
// Rather than fake that with noise pretending to be "live audio", this
// reacts honestly to game state you already know is true — which is also
// why the same state name doubles as a readable class for CSS to target.
const BAR_COUNT = 16;

export default function Visualizer({ state = "idle" }) {
  return (
    <div className={`visualizer state-${state}`} aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div key={i} className="visualizer-bar" style={{ animationDelay: `${(i % 8) * 0.07}s` }} />
      ))}
    </div>
  );
}