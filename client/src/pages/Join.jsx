import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getSocket } from "../lib/socket";
import Turntable from "../components/Turntable";
import AmbientParticles from "../components/AmbientParticles";
import "../components/game-ui.css";

// Purely cosmetic pause between a REAL successful join and navigating away,
// so the "room found → entering" beats are visible. Never shown on failure.
const ENTER_TRANSITION_MS = 500;

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  // idle | connecting | found — reflects the real socket ack, nothing faked.
  const [stage, setStage] = useState("idle");

  function handleJoin(e) {
    e.preventDefault();
    setError("");
    if (!code.trim() || !name.trim()) {
      setError("Enter both a room code and your name.");
      return;
    }
    setStage("connecting");
    const socket = getSocket();
    const playerId = crypto.randomUUID();
    socket.emit(
      "player:join-room",
      { code: code.trim().toUpperCase(), name: name.trim(), playerId },
      (res) => {
        if (!res.ok) {
          setStage("idle");
          setError(res.error || "Couldn't join that room.");
          return;
        }
        setStage("found");
        setTimeout(() => {
          navigate("/play", {
            state: {
              name: name.trim(),
              roomCode: res.roomCode,
              playerId: res.playerId || playerId,
              trackChoices: res.trackChoices || [],
            },
          });
        }, ENTER_TRANSITION_MS);
      }
    );
  }

  const joining = stage !== "idle";

  return (
    <div className="studio studio--join">
      <div className="studio-bg" />
      <AmbientParticles />
      <div className="studio-content">
        <div className="studio-header studio-enter">
          <div className="studio-logo">
            <span className="mark" />
            NEEDLE DROP
          </div>
          <div className="studio-eyebrow">Enter the room</div>
        </div>

        <div className="neon-panel neon-panel--glow-violet studio-enter studio-enter--1" style={{ textAlign: "center" }}>
          <Turntable variant="join" spinning={false} />

          {stage === "found" ? (
            <>
              <h1 className="section-title">Room found</h1>
              <p className="hint">Entering room…</p>
            </>
          ) : (
            <>
              <h1 className="section-title">Enter the Room</h1>
              <p className="subtitle" style={{ margin: "0 auto 24px" }}>
                Ask your host for the 4-letter room code.
              </p>

              <form onSubmit={handleJoin} style={{ textAlign: "left" }}>
                <label htmlFor="code">Room code</label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="A B 7 K 2"
                  maxLength={4}
                  disabled={joining}
                  className="room-code-input-field"
                  style={{
                    marginBottom: 16,
                    letterSpacing: "0.35em",
                    textAlign: "center",
                    fontFamily: "var(--mono)",
                    fontSize: "1.6rem",
                    fontWeight: 700,
                  }}
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
                  disabled={joining}
                  style={{ marginBottom: 20 }}
                />
                <button
                  className="console-btn console-btn--ghost console-btn--block"
                  style={{
                    borderColor: "rgba(185, 138, 245, 0.5)",
                    color: "var(--studio-violet)",
                  }}
                  disabled={joining}
                >
                  {stage === "connecting" ? "Connecting…" : "Enter room →"}
                </button>
                {error && <p className="error-text">{error}</p>}
              </form>
            </>
          )}
        </div>

        {stage === "idle" && (
          <Link to="/" className="hint" style={{ marginTop: 20, display: "inline-block" }}>
            ← Back
          </Link>
        )}
      </div>
    </div>
  );
}
