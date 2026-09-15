import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getSocket } from "../lib/socket";
import StatusScreen from "../components/StatusScreen.jsx";

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
          // Only real server-side errors are surfaced here — "Room not
          // found." and "This game has already ended." are the only two
          // gameManager.js actually returns. There is no room-capacity
          // limit in the backend, so no "room full" state is shown.
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

  if (error) {
    return (
      <div className="screen">
        <div className="hero-eyebrow">Join Game</div>
        <h1 className="display-lg" style={{ marginBottom: 20 }}>
          JOIN GAME
        </h1>
        <StatusScreen
          kind="error"
          title="Couldn't join that room"
          message={error}
          actions={[
            { label: "Try again", primary: true, onClick: () => setError("") },
            { label: "Back home", onClick: () => navigate("/") },
          ]}
        />
      </div>
    );
  }

  if (joining) {
    return (
      <div className="screen">
        <StatusScreen kind="loading" title="Joining room…" />
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="hero-eyebrow">Join Game</div>
      <h1 className="display-lg" style={{ marginBottom: 8 }}>
        JOIN GAME
      </h1>
      <p className="subtitle" style={{ textAlign: "center", marginInline: "auto", marginBottom: 32 }}>
        Ask your host for the 4-letter room code.
      </p>

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
        <button className="btn btn-primary btn-block cursor-target" disabled={joining}>
          Join room
        </button>
      </form>

      <Link to="/" className="hint cursor-target" style={{ marginTop: 20 }}>
        ← Back
      </Link>
    </div>
  );
}