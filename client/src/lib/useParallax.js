import { useEffect, useRef } from "react";

// Attaches pointer-tracked parallax offsets (normalized -0.5..0.5) to a CSS
// custom property pair on the given ref's element. Multiple elements can
// share the same stage (a common ancestor with class "parallax-stage") and
// apply different multipliers to their own transforms for a layered-depth
// effect, without each one re-attaching its own listener.
//
// No-ops entirely on touch devices and when prefers-reduced-motion is set.
export function useParallaxLayer(varX = "--px", varY = "--py") {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (reduceMotion || isTouch) return;

    const stage = el.closest(".parallax-stage") || window;

    function onMove(e) {
      const rect = (stage === window ? document.body : stage).getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty(varX, px.toFixed(4));
      el.style.setProperty(varY, py.toFixed(4));
    }
    function onLeave() {
      el.style.setProperty(varX, "0");
      el.style.setProperty(varY, "0");
    }

    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    return () => {
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
    };
  }, [varX, varY]);

  return ref;
}