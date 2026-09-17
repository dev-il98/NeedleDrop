import { forwardRef } from "react";

// Standalone big vinyl disc for the Home-page scroll effect. Reuses the
// exact same .platter / .platter-sheen / .platter-label / .platter-hole
// CSS that Turntable.jsx's inner disc uses — Turntable.jsx itself is not
// modified, so Solo/Host/Join/PlayerGame are unaffected. forwardRef lets
// the caller apply scroll-driven transforms directly to the DOM node
// every frame without going through React state/re-renders.
const Vinyl = forwardRef(function Vinyl({ size = 400 }, ref) {
  return (
    <div className="vinyl-disc" style={{ "--tt-size": `${size}px` }} ref={ref}>
      <div className="platter">
        <div className="platter-sheen" />
        <div className="platter-label">
          <div className="platter-hole" />
        </div>
      </div>
    </div>
  );
});

export default Vinyl;