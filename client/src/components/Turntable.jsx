import { useEffect, useRef } from "react";

// Reusable 3D turntable — disc + tonearm + ambient glow.
// `spinning` drops the tonearm and starts the disc turning.
// `parallax` (desktop-only hero use) tilts the whole thing toward the
// pointer for a physical, "sitting on a table" feel.
export default function Turntable({ spinning = false, size = 160, parallax = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!parallax) return;
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (reduceMotion || isTouch) return;

    function onMove(e) {
      const rect = el.parentElement.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--ry", `${px * 16}deg`);
      el.style.setProperty("--rx", `${py * -10}deg`);
    }
    function onLeave() {
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--rx", "0deg");
    }

    const stage = el.closest(".turntable-stage") || window;
    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    return () => {
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
    };
  }, [parallax]);

  return (
    <div className="turntable" ref={ref} style={{ "--tt-size": `clamp(120px, 40vw, ${size}px)` }}>
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