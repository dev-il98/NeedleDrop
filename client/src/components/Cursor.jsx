import { useEffect, useRef, useState } from "react";

// Desktop-only custom cursor with distinct states. Renders nothing on
// touch devices or when prefers-reduced-motion is set.
export default function Cursor() {
  const dotRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState("normal"); // normal | interactive | button | play

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (reduceMotion || isTouch) return;
    setEnabled(true);

    function onMove(e) {
      const el = dotRef.current;
      if (el) el.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;

      const target = e.target;
      if (target.closest(".turntable, .turntable-stage")) {
        setMode("play");
      } else if (target.closest(".btn")) {
        setMode("button");
      } else if (target.closest("a, input, select, .cursor-target, .big-choice, .track-row")) {
        setMode("interactive");
      } else {
        setMode("normal");
      }
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  if (!enabled) return null;

  return <div ref={dotRef} className={`custom-cursor cursor-${mode}`} />;
}