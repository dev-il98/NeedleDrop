import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getSocket } from "../lib/socket";

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  function handleJoin(e) {
    e.preventDefault();
    setError("");
    if (!code.trim() || !name.trim()) {
      setError("Enter both a room code and your name.");
      return;
    }
    setJoining(true);
    const socket = getSocket();
    socket.emit(
      "player:join-room",
      { code: code.trim().toUpperCase(), name: name.trim() },
      (res) => {
        setJoining(false);
        if (!res.ok) {
          setError(res.error || "Couldn't join that room.");
          return;
        }
        navigate("/play", {
          state: {
            name: name.trim(),
            roomCode: res.roomCode,
            trackChoices: res.trackChoices || [],
          },
        });
      }
    );
  }

  return (
    <div className="screen">
      <div className="brand">
        <span className="brand-mark">JOIN GAME</span>
      </div>
      <p className="subtitle">Ask your host for the 4-letter room code.</p>

      <form className="card" onSubmit={handleJoin}>
        <label htmlFor="code">Room code</label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. 7F3K"
          maxLength={4}
          style={{ marginBottom: 16, letterSpacing: "0.2em", textAlign: "center" }}
          autoFocus
        />
        <label htmlFor="name">Your name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={20}
          style={{ marginBottom: 20 }}
        />
        <button className="btn btn-primary btn-block" disabled={joining}>
          {joining ? "Joining…" : "Join room"}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>

      <Link to="/" className="hint" style={{ marginTop: 20 }}>
        ← Back
      </Link>
    </div>
  );
}