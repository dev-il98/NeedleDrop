import { useConnectionStatus } from "../lib/useConnectionStatus.js";

const LABEL = {
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

// Only renders for non-"connected" states — silent when everything's fine,
// so it never becomes background noise during normal play.
export default function ConnectionBadge({ socket }) {
  const status = useConnectionStatus(socket);
  if (status === "connected") return null;
  return (
    <div className={`connection-badge status-${status}`} role="status" aria-live="polite">
      <span className="connection-dot" />
      {LABEL[status]}
    </div>
  );
}