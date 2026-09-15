import "./studio.css";

export default function StudioTurntable({
  mode = "solo",
  spinning = false,
  stopping = false,
}) {
  const discState = stopping
    ? "studio-record--stopping"
    : spinning
      ? "studio-record--spinning"
      : "";

  return (
    <div className={`studio-turntable studio-turntable--${mode}`}>
      <div className="studio-turntable__base">
        <div className="studio-turntable__plate">
          <div className={`studio-record ${discState}`}>
            <div className="studio-record__grooves" />
            <div className="studio-record__reflection" />

            <div className="studio-record__label">
              <span>ND</span>
            </div>

            <div className="studio-record__hole" />
          </div>
        </div>

        <div
          className={`studio-tonearm ${
            spinning ? "studio-tonearm--active" : ""
          }`}
        >
          <div className="studio-tonearm__pivot" />
          <div className="studio-tonearm__arm" />
          <div className="studio-tonearm__needle" />
        </div>

        <div className="studio-controls">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="studio-turntable__shadow" />
    </div>
  );
}