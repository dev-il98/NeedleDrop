import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

import { getSocket } from "../lib/socket";

import StudioScene from "../components/StudioScene";
import StudioTurntable from "../components/StudioTurntable";
import StudioWaveform from "../components/StudioWaveform";

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [code, setCode] = useState(
    params.get("code") || ""
  );

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  function handleJoin(e) {
    e.preventDefault();

    setError("");

    if (!code.trim() || !name.trim()) {
      setError(
        "Enter both a room code and your name."
      );
      return;
    }

    setJoining(true);

    const socket = getSocket();

    socket.emit(
      "player:join-room",
      {
        code: code.trim().toUpperCase(),
        name: name.trim(),
      },
      (res) => {
        setJoining(false);

        if (!res.ok) {
          setError(
            res.error ||
              "Couldn't join that room."
          );
          return;
        }

        navigate("/play", {
          state: {
            name: name.trim(),
            roomCode: res.roomCode,
            trackChoices:
              res.trackChoices || [],
          },
        });
      }
    );
  }

  /*
   * =========================================================
   * ERROR
   * =========================================================
   */

  if (error) {
    return (
      <StudioScene mode="join">
        <div className="studio-page-header">
          <div className="studio-page-logo">
            <span className="studio-page-logo__mark">
              ●
            </span>

            <span>
              NEEDLE
              <br />
              DROP
            </span>
          </div>

          <div className="studio-page-eyebrow">
            UNDERGROUND CLUB
          </div>
        </div>

        <div className="studio-join-error-layout">
          <div className="studio-join-error-copy">
            <span className="studio-kicker">
              ENTRY DENIED
            </span>

            <h1>
              WRONG
              <br />
              <span>VIBE.</span>
            </h1>

            <p>
              We couldn't get you into that
              room. Check the code and try
              again.
            </p>

            <div className="studio-error-box">
              <span>ERROR</span>
              <strong>{error}</strong>
            </div>

            <div className="studio-error-actions">
              <button
                className="studio-primary-button studio-primary-button--join"
                onClick={() => setError("")}
              >
                TRY AGAIN
              </button>

              <Link
                to="/"
                className="studio-back-link"
              >
                ← BACK TO HOME
              </Link>
            </div>
          </div>

          <div className="studio-join-error-visual">
            <StudioTurntable
              mode="join"
              stopping
            />

            <StudioWaveform
              state="wrong"
            />
          </div>
        </div>
      </StudioScene>
    );
  }

  /*
   * =========================================================
   * JOINING
   * =========================================================
   */

  if (joining) {
    return (
      <StudioScene mode="join">
        <div className="studio-page-header">
          <div className="studio-page-logo">
            <span className="studio-page-logo__mark">
              ●
            </span>

            <span>
              NEEDLE
              <br />
              DROP
            </span>
          </div>

          <div className="studio-page-eyebrow">
            CONNECTING TO CLUB
          </div>
        </div>

        <div className="studio-joining-layout">
          <StudioTurntable
            mode="join"
            spinning
          />

          <StudioWaveform
            state="listening"
          />

          <span className="studio-kicker">
            CONNECTING
          </span>

          <h1>
            FINDING
            <br />
            THE <span>ROOM.</span>
          </h1>

          <p>
            Getting you onto the dance floor…
          </p>

          <div className="studio-joining-indicator">
            <span />
            <span />
            <span />
          </div>
        </div>
      </StudioScene>
    );
  }

  /*
   * =========================================================
   * JOIN FORM
   * =========================================================
   */

  return (
    <StudioScene mode="join">
      <div className="studio-page-header">
        <div className="studio-page-logo">
          <span className="studio-page-logo__mark">
            ●
          </span>

          <span>
            NEEDLE
            <br />
            DROP
          </span>
        </div>

        <div className="studio-page-eyebrow">
          UNDERGROUND CLUB
        </div>
      </div>

      <div className="studio-join-layout">
        {/* LEFT SIDE */}

        <div className="studio-join-copy">
          <span className="studio-kicker">
            PLAYER MODE
          </span>

          <h1>
            ENTER
            <br />
            THE
            <br />
            <span>CLUB.</span>
          </h1>

          <p>
            Your host has started a session.
            Enter the room code, choose your
            name, and get ready for the drop.
          </p>

          <div className="studio-club-status">
            <span className="studio-club-status__dot" />

            <div>
              <strong>
                LIVE ROOM
              </strong>

              <small>
                WAITING FOR PLAYERS
              </small>
            </div>
          </div>

          <StudioWaveform
            state="idle"
          />
        </div>

        {/* CENTER RECORD */}

        <div className="studio-join-record">
          <StudioTurntable
            mode="join"
            spinning={false}
          />

          <div className="studio-join-record-label">
            NEEDLE
            <br />
            DROP
          </div>
        </div>

        {/* RIGHT FORM */}

        <div className="studio-join-panel">
          <div className="studio-panel-header">
            <span>01</span>

            <h2>
              ENTER THE ROOM
            </h2>
          </div>

          <form
            onSubmit={handleJoin}
            autoComplete="off"
          >
            {/* ROOM CODE */}

            <div className="studio-field studio-room-code-field">
              <label htmlFor="code">
                ROOM CODE
              </label>

              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(
                        /[^A-Z0-9]/g,
                        ""
                      )
                  )
                }
                placeholder="7F3K"
                maxLength={4}
                autoFocus
                spellCheck="false"
                autoComplete="off"
                className="studio-room-code-input"
              />

              <p className="studio-field-hint">
                Ask your host for the
                4-character room code.
              </p>
            </div>

            {/* NAME */}

            <div className="studio-field">
              <label htmlFor="name">
                YOUR NAME
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="What should we call you?"
                maxLength={20}
                autoComplete="nickname"
              />
            </div>

            {/* JOIN */}

            <button
              type="submit"
              className="studio-primary-button studio-primary-button--full studio-primary-button--join"
              disabled={
                joining ||
                !code.trim() ||
                !name.trim()
              }
            >
              ENTER THE CLUB →
            </button>
          </form>

          <div className="studio-join-tip">
            <span>TIP</span>

            <p>
              Use the same name your friends
              will recognize on the leaderboard.
            </p>
          </div>

          <Link
            to="/"
            className="studio-back-link"
          >
            ← BACK TO HOME
          </Link>
        </div>
      </div>
    </StudioScene>
  );
}