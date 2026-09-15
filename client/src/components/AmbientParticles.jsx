export default function AmbientParticles({ count = 18 }) {
  return (
    <div className="ambient-particles" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="ambient-particle"
          style={{
            left: `${(index * 37) % 100}%`,
            top: `${(index * 61) % 100}%`,
            animationDelay: `${(index % 6) * 0.7}s`,
          }}
        />
      ))}
    </div>
  );
}