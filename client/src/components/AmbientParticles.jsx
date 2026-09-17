import "./game-ui.css";

const POSITIONS = [
  { top: "10%", left: "15%", delay: "0s" },
  { top: "20%", left: "80%", delay: "1.2s" },
  { top: "55%", left: "8%", delay: "2.1s" },
  { top: "70%", left: "88%", delay: "0.6s" },
  { top: "40%", left: "50%", delay: "1.8s" },
];

// Cheap on purpose — a handful of CSS-animated dots, not a particle system.
export default function AmbientParticles() {
  return (
    <div className="ambient-particles" aria-hidden="true">
      {POSITIONS.map((p, i) => (
        <span
          key={i}
          className="ambient-particle"
          style={{ top: p.top, left: p.left, animationDelay: p.delay }}
        />
      ))}
    </div>
  );
}
