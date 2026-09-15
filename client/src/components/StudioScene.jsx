import "./studio.css";

export default function StudioScene({
  mode = "solo",
  children,
  spinning = false,
  stopping = false,
}) {
  return (
    <main className={`studio-scene studio-scene--${mode}`}>
      <div className="studio-scene__ambient" />

      <div className="studio-scene__lights">
        <span className="studio-light studio-light--one" />
        <span className="studio-light studio-light--two" />
        <span className="studio-light studio-light--three" />
      </div>

      <div className="studio-scene__particles" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            style={{
              "--i": i,
              "--x": `${(i * 47) % 100}%`,
              "--y": `${(i * 31) % 100}%`,
            }}
          />
        ))}
      </div>

      <div className="studio-scene__background">
        <div className="studio-window">
          <div className="studio-city">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>

        <div className="studio-shelf">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="studio-speaker studio-speaker--left">
          <div className="speaker-driver" />
        </div>

        <div className="studio-speaker studio-speaker--right">
          <div className="speaker-driver" />
        </div>
      </div>

      <div className="studio-scene__content">
        {children}
      </div>
    </main>
  );
}