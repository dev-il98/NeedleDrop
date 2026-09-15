import { useEffect, useState } from "react";

// Reads the actual Socket.IO client connection lifecycle — these events
// (connect/disconnect on the socket, reconnect_attempt/reconnect on its
// Manager) are standard socket.io-client v4 API, not invented signals.
// Returns "connected" | "connecting" | "reconnecting" | "disconnected".
export function useConnectionStatus(socket) {
  const [status, setStatus] = useState(socket.connected ? "connected" : "connecting");

  useEffect(() => {
    function onConnect() {
      setStatus("connected");
    }
    function onDisconnect() {
      setStatus("disconnected");
    }
    function onReconnectAttempt() {
      setStatus("reconnecting");
    }
    function onReconnect() {
      setStatus("connected");
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
    };
  }, [socket]);

  return status;
}