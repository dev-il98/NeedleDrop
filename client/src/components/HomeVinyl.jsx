import { useEffect, useRef } from "react";
import Vinyl from "./Vinyl.jsx";

// Waypoints as {p: progress 0-1, x/y: percent of viewport, tilt: base
// rotateY in deg, scale}. Desktop and mobile are tuned separately rather
// than one path scaled down, per the brief. Tuned loosely against Home's
// actual sections: hero → mode cards → how-it-works → preview/features →
// final CTA.
const DESKTOP_PATH = [
  { p: 0, x: 62, y: 14, tilt: -4, scale: 1 },
  { p: 0.25, x: 40, y: 32, tilt: 3, scale: 0.92 },
  { p: 0.5, x: 68, y: 52, tilt: -3, scale: 0.85 },
  { p: 0.75, x: 34, y: 72, tilt: 4, scale: 0.78 },
  { p: 1, x: 55, y: 90, tilt: 0, scale: 0.7 },
];

const MOBILE_PATH = [
  { p: 0, x: 78, y: 10, tilt: -3, scale: 0.55 },
  { p: 0.3, x: 20, y: 34, tilt: 3, scale: 0.5 },
  { p: 0.6, x: 75, y: 60, tilt: -3, scale: 0.46 },
  { p: 1, x: 25, y: 88, tilt: 0, scale: 0.42 },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function samplePath(path, progress) {
  if (progress <= path[0].p) return path[0];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (progress >= a.p && progress <= b.p) {
      const t = (progress - a.p) / (b.p - a.p || 1);
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        tilt: lerp(a.tilt, b.tilt, t),
        scale: lerp(a.scale, b.scale, t),
      };
    }
  }
  return path[path.length - 1];
}

export default function HomeVinyl() {
  const wrapperRef = useRef(null);
  const discRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      // No scroll response at all — a tasteful static placement instead.
      const wrapper = wrapperRef.current;
      const disc = discRef.current;
      if (wrapper) wrapper.style.transform = "translate3d(58vw, 16vh, 0)";
      if (disc) disc.style.transform = "translate(-50%, -50%) rotateX(6deg) rotateY(-4deg) scale(0.85)";
      return;
    }

    const state = {
      progress: 0,
      targetProgress: 0,
      spin: 0,
      velocityTilt: 0,
      targetVelocityTilt: 0,
      lastScrollY: window.scrollY,
      lastTime: performance.now(),
    };
    const isMobile = { current: window.innerWidth < 720 };

    function computeTargetProgress() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      state.targetProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    }
    function onScroll() {
      computeTargetProgress();
    }
    function onResize() {
      isMobile.current = window.innerWidth < 720;
      computeTargetProgress();
    }

    // Sync immediately so a mid-scroll page load doesn't animate in
    // from the top — the disc should already be "wherever scroll is."
    computeTargetProgress();
    state.progress = state.targetProgress;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    function tick(now) {
      const dt = now - state.lastTime;
      state.lastTime = now;

      // Inertia toward the real scroll position rather than snapping.
      state.progress += (state.targetProgress - state.progress) * 0.08;

      const scrollDeltaY = window.scrollY - state.lastScrollY;
      state.lastScrollY = window.scrollY;

      // Spin driven by actual scroll distance (not time), so reversing
      // scroll direction genuinely reverses rotation direction.
      state.spin += scrollDeltaY * 0.6;

      // Velocity-based transient tilt, eased toward its target so it
      // reads as inertia rather than snapping with each scroll event.
      state.targetVelocityTilt = Math.max(-14, Math.min(14, scrollDeltaY * 0.5));
      state.velocityTilt += (state.targetVelocityTilt - state.velocityTilt) * 0.12;

      const path = isMobile.current ? MOBILE_PATH : DESKTOP_PATH;
      const sample = samplePath(path, state.progress);
      // Sine wobble layered on the waypoint path so the route never
      // reads as a perfectly straight line between points.
      const wobble = Math.sin(state.progress * Math.PI * 3) * (isMobile.current ? 3 : 5);

      const xPx = ((sample.x + wobble) / 100) * window.innerWidth;
      const yPx = (sample.y / 100) * window.innerHeight;

      const wrapper = wrapperRef.current;
      const disc = discRef.current;
      if (wrapper) {
        wrapper.style.transform = `translate3d(${xPx.toFixed(1)}px, ${yPx.toFixed(1)}px, 0)`;
      }
      if (disc) {
        disc.style.transform =
          `translate(-50%, -50%) ` +
          `rotateX(${(6 + state.velocityTilt * 0.4).toFixed(2)}deg) ` +
          `rotateY(${(sample.tilt + state.velocityTilt * 0.6).toFixed(2)}deg) ` +
          `rotateZ(${state.spin.toFixed(2)}deg) ` +
          `scale(${sample.scale.toFixed(3)})`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="home-vinyl-layer" aria-hidden="true">
      <div className="home-vinyl-wrap" ref={wrapperRef}>
        <Vinyl ref={discRef} size={520} />
      </div>
    </div>
  );
}