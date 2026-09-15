import Turntable from "./Turntable.jsx";

// Unified loading/error/empty state. `actions` is an array of
// { label, onClick, primary? } — real, wired callbacks only (Try Again /
// Go Back / Return Home), never decorative buttons that do nothing.
export default function StatusScreen({ kind = "loading", title, message, actions = [] }) {
  return (
    <div className={`status-screen status-${kind}`}>
      {kind === "loading" && <Turntable size={90} spinning />}
      {kind === "error" && (
        <div className="status-icon status-icon-error" aria-hidden="true">
          !
        </div>
      )}
      {kind === "empty" && (
        <div className="status-icon status-icon-empty" aria-hidden="true">
          –
        </div>
      )}
      {title && (
        <h3 className="section-title" style={{ marginTop: 16, textAlign: "center" }}>
          {title}
        </h3>
      )}
      {message && (
        <p className="hint" style={{ textAlign: "center", maxWidth: 340 }}>
          {message}
        </p>
      )}
      {actions.length > 0 && (
        <div className="status-actions">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              className={`btn ${a.primary ? "btn-primary" : "btn-ghost"} cursor-target`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}