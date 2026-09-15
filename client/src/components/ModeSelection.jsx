import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./mode-selection.css";

/* ------------------------------------------------------------------ *
 * Inline SVGs — no new dependency. Each icon is layered: a dark back
 * plate for mass, a lit face, and a highlight edge, so it reads 3D.
 * ------------------------------------------------------------------ */

function HeadphonesIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ndm-face-lime" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2ff8c" />
          <stop offset="1" stopColor="#5f8f1f" />
        </linearGradient>
      </defs>
      <g className="ndmode-icon__back">
        <path d="M12 38v-6a20 20 0 0 1 40 0v6" />
        <rect x="8" y="36" width="12" height="18" rx="6" />
        <rect x="44" y="36" width="12" height="18" rx="6" />
      </g>
      <g className="ndmode-icon__face">
        <path
          d="M10 36v-4a22 22 0 0 1 44 0v4"
          fill="none"
          stroke="url(#ndm-face-lime)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect x="6" y="34" width="13" height="19" rx="6.5" fill="url(#ndm-face-lime)" />
        <rect x="45" y="34" width="13" height="19" rx="6.5" fill="url(#ndm-face-lime)" />
        <rect x="9.5" y="38" width="6" height="11" rx="3" fill="#0a0d06" opacity=".45" />
        <rect x="48.5" y="38" width="6" height="11" rx="3" fill="#0a0d06" opacity=".45" />
      </g>
      <path
        className="ndmode-icon__edge"
        d="M15 30a17 17 0 0 1 22-5"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HostIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ndm-face-amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd79a" />
          <stop offset="1" stopColor="#bf6410" />
        </linearGradient>
      </defs>
      <g className="ndmode-icon__back">
        <circle cx="18" cy="34" r="7" />
        <circle cx="46" cy="34" r="7" />
        <path d="M7 55c0-6.5 5-10.5 11-10.5S29 48.5 29 55z" />
        <path d="M35 55c0-6.5 5-10.5 11-10.5S57 48.5 57 55z" />
      </g>
      <g className="ndmode-icon__face">
        <g opacity=".4">
          <circle cx="17.5" cy="33" r="6.5" fill="url(#ndm-face-amber)" />
          <path d="M7 53c0-6 4.7-10.5 10.5-10.5S28 47 28 53z" fill="url(#ndm-face-amber)" />
          <circle cx="46.5" cy="33" r="6.5" fill="url(#ndm-face-amber)" />
          <path d="M36 53c0-6 4.7-10.5 10.5-10.5S57 47 57 53z" fill="url(#ndm-face-amber)" />
        </g>
        <circle cx="32" cy="31" r="8.5" fill="url(#ndm-face-amber)" />
        <path d="M18 56c0-7.7 6.3-14 14-14s14 6.3 14 14z" fill="url(#ndm-face-amber)" />
        <path
          className="ndmode-icon__crown"
          d="M23.5 19 27 13.5l5 5 5-5 3.5 5.5V22h-17z"
          fill="url(#ndm-face-amber)"
        />
      </g>
      <path
        className="ndmode-icon__edge"
        d="M26 27a8.5 8.5 0 0 1 8-3.5"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function JoinIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ndm-face-violet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ddc2ff" />
          <stop offset="1" stopColor="#7a3ddb" />
        </linearGradient>
      </defs>
      <g className="ndmode-icon__back">
        <rect x="8" y="27" width="26" height="16" rx="8" />
        <rect x="30" y="27" width="26" height="16" rx="8" />
      </g>
      <g
        className="ndmode-icon__face"
        stroke="url(#ndm-face-violet)"
        fill="none"
        strokeWidth="4.5"
        strokeLinecap="round"
      >
        <path d="M27 22h-8a10 10 0 0 0 0 20h8" />
        <path d="M37 42h8a10 10 0 0 0 0-20h-8" />
        <path d="M24.5 32h15" strokeWidth="4" opacity=".75" />
      </g>
      <g className="ndmode-icon__badge">
        <circle cx="49" cy="16" r="10" fill="url(#ndm-face-violet)" />
        <path d="M49 11v10M44 16h10" stroke="#140826" strokeWidth="3.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 12h13m-5.5-5.5L18 12l-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

const MODES = [
  {
    to: "/solo",
    accent: "lime",
    title: "Play solo",
    desc: ["Your Spotify, your pace —", "no room needed."],
    Icon: HeadphonesIcon,
  },
  {
    to: "/host",
    accent: "amber",
    title: "Host",
    desc: ["Create a room and", "play with friends."],
    Icon: HostIcon,
  },
  {
    to: "/join",
    accent: "violet",
    title: "Join",
    desc: ["Got a code from a host?", "Jump straight in."],
    Icon: JoinIcon,
  },
];

// Deterministic dust motes — 14, not hundreds.
const MOTES = [
  [6, 72, 9, 0], [14, 28, 13, 1.4], [21, 88, 11, 2.7], [29, 47, 15, 0.6],
  [37, 18, 10, 3.3], [44, 78, 14, 1.9], [52, 35, 12, 0.3], [59, 92, 9, 2.2],
  [66, 22, 16, 4.1], [73, 63, 11, 1.1], [81, 40, 13, 3.6], [87, 84, 10, 2.5],
  [93, 15, 12, 0.9], [97, 57, 14, 3.9],
];

export default function ModeSelection() {
  const sectionRef = useRef(null);

  /* Reveal once the section is actually on screen. */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    if (!("IntersectionObserver" in window)) {
      el.classList.add("is-revealed");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add("is-revealed");
            io.disconnect();
          }
        });
      },
      { threshold: 0.18 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Pointer parallax + per-card tilt. Fine pointers only, motion permitting. */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pending = null;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      const { px, py, cards } = pending;
      el.style.setProperty("--ndm-px", px.toFixed(3));
      el.style.setProperty("--ndm-py", py.toFixed(3));
      cards.forEach(({ node, rx, ry }) => {
        node.style.setProperty("--ndm-rx", `${rx.toFixed(2)}deg`);
        node.style.setProperty("--ndm-ry", `${ry.toFixed(2)}deg`);
      });
      pending = null;
    };

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 … 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5;

      const cards = [];
      el.querySelectorAll(".ndmode-card").forEach((node) => {
        const r = node.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width - 0.5;
        const cy = (e.clientY - r.top) / r.height - 0.5;
        const near = Math.abs(cx) < 1.15 && Math.abs(cy) < 1.6;
        cards.push({
          node,
          ry: near ? cx * 10 : 0, // ±5deg
          rx: near ? -cy * 6 : 0, // ±3deg
        });
      });

      pending = { px, py, cards };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
      el.style.setProperty("--ndm-px", "0");
      el.style.setProperty("--ndm-py", "0");
      el.querySelectorAll(".ndmode-card").forEach((node) => {
        node.style.setProperty("--ndm-rx", "0deg");
        node.style.setProperty("--ndm-ry", "0deg");
      });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      className="ndmode-section"
      id="play"
      ref={sectionRef}
      aria-labelledby="ndmode-heading"
    >
      {/* ---------- background stage ---------- */}
      <div className="ndmode-stage" aria-hidden="true">
        <div className="ndmode-pool ndmode-pool--lime" />
        <div className="ndmode-pool ndmode-pool--amber" />
        <div className="ndmode-pool ndmode-pool--violet" />

        <div className="ndmode-vinyl">
          <svg viewBox="0 0 400 400">
            <circle cx="200" cy="200" r="198" className="ndmode-vinyl__disc" />
            {[178, 160, 142, 124, 106, 88].map((r) => (
              <circle key={r} cx="200" cy="200" r={r} className="ndmode-vinyl__groove" />
            ))}
            <circle cx="200" cy="200" r="66" className="ndmode-vinyl__label" />
            <circle cx="200" cy="200" r="7" className="ndmode-vinyl__spindle" />
            <path d="M200 4a196 196 0 0 1 138 57" className="ndmode-vinyl__sheen" />
          </svg>
        </div>

        <div className="ndmode-cans">
          <svg viewBox="0 0 240 200">
            <path d="M30 128V96a90 90 0 0 1 180 0v32" />
            <rect x="12" y="120" width="42" height="64" rx="21" />
            <rect x="186" y="120" width="42" height="64" rx="21" />
          </svg>
        </div>

        <div className="ndmode-sleeves">
          <span className="ndmode-sleeve ndmode-sleeve--a" />
          <span className="ndmode-sleeve ndmode-sleeve--b" />
          <span className="ndmode-sleeve ndmode-sleeve--c" />
        </div>

        <div className="ndmode-motes">
          {MOTES.map(([left, top, dur, delay], i) => (
            <span
              key={i}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animationDuration: `${dur}s`,
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>

        <div className="ndmode-grain" />
      </div>

      {/* ---------- content ---------- */}
      <div className="ndmode-inner">
        <div className="ndmode-eyebrow">Choose your mode</div>
        <h2 className="ndmode-heading" id="ndmode-heading">
          Three ways to <span className="ndmode-heading__accent">drop.</span>
        </h2>
        <p className="ndmode-sub">
          Same songs, different vibes. Pick how you want to play and let the
          music take over.
        </p>

        <div className="ndmode-grid">
          {MODES.map(({ to, accent, title, desc, Icon }, i) => (
            <Link
              key={to}
              to={to}
              className="ndmode-card cursor-target"
              data-accent={accent}
              style={{ "--ndm-i": i }}
            >
              <span className="ndmode-card__sheen" aria-hidden="true" />
              <span className="ndmode-card__bloom" aria-hidden="true" />

              <span className="ndmode-card__icon">
                <Icon />
              </span>

              <span className="ndmode-card__body">
                <span className="ndmode-card__title">{title}</span>
                <span className="ndmode-card__desc">
                  {desc[0]}
                  <br />
                  {desc[1]}
                </span>
              </span>

              <span className="ndmode-card__arrow" aria-hidden="true">
                <ArrowGlyph />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}