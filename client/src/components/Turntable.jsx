import { useParallaxLayer } from "../lib/useParallax.js";

// Reusable 3D turntable — disc + tonearm + ambient glow + sound rings.
// `spinning` drops the tonearm and starts the disc turning.
// `parallax` (desktop-only) tilts the whole assembly toward the pointer,
// via the shared useParallaxLayer hook so it can share a pointer source
// with other depth layers on the same page (see Home.jsx's background grid).
export default function Turntable({ spinning = false, size = 160, parallax = false }) {
  const ref = useParallaxLayer("--px", "--py");

  const style = { "--tt-size": `clamp(120px, 40vw, ${size}px)` };

  return (
    <div
      className={`turntable${parallax ? " turntable-parallax" : ""}`}
      ref={parallax ? ref : null}
      style={style}
    >
      <div className="turntable-rings" aria-hidden="true">
        <div className="sound-ring" />
        <div className="sound-ring" />
      </div>
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