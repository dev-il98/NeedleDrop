// Reusable 3D turntable — used on Home, Host, Solo, and PlayerGame.
// `spinning` puts the disc in motion and drops the tonearm onto it.
// `size` is the natural width/height in px; it auto-shrinks on narrow
// screens via clamp() so it never needs its own media queries.
export default function Turntable({ spinning = false, size = 160 }) {
  return (
    <div className="turntable" style={{ "--tt-size": `clamp(120px, 40vw, ${size}px)` }}>
      <div className="turntable-glow" />
      <div className={`platter${spinning ? " spinning" : ""}`}>
        <div className="platter-sheen" />
        <div className="platter-label">
          <div className="platter-hole" />
        </div>
      </div>
      <div className={`tonearm${spinning ? " tonearm-down" : ""}`}>
        <div className="tonearm-base" />
        <div className="tonearm-arm">
          <div className="tonearm-head" />
        </div>
      </div>
    </div>
  );
}