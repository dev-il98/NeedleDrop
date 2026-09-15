import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

import { api, captureSidFromUrl } from "../lib/api";
import { getSocket } from "../lib/socket";
import { createHostPlayer } from "../lib/spotifyPlayer";

import ConnectionBadge from "../components/ConnectionBadge.jsx";
import PlaylistPicker from "../components/PlaylistPicker.jsx";

import StudioScene from "../components/StudioScene";
import StudioTurntable from "../components/StudioTurntable";
import StudioHUD from "../components/StudioHUD";
import StudioWaveform from "../components/StudioWaveform";

const ROUND_OPTIONS = [5, 10, 15, 20, 25, 30];

const SNIPPET_OPTIONS = [
  {
    seconds: 1,
    multiplier: "2.0x",
    label: "1 second — brutal",
  },
  {
    seconds: 2,
    multiplier: "1.5x",
    label: "2 seconds — hard",
  },
  {
    seconds: 3,
    multiplier: "1.2x",
    label: "3 seconds — medium",
  },
  {
    seconds: 5,
    multiplier: "1.0x",
    label: "5 seconds — easy",
  },
  {
    seconds: 10,
    multiplier: "0.7x",
    label: "10 seconds — very easy",
  },
];

export default function Host() {
  const [params] = useSearchParams();

  const socket = getSocket();

  const deviceIdRef = useRef(null);
  const timerRef = useRef(null);

  const [connected, setConnected] = useState(null);
  const [connectError, setConnectError] = useState(
    params.get("error") || ""
  );

  const [playlists, setPlaylists] = useState([]);
  const [likedCount, setLikedCount] = useState(null);

  const [selectedId, setSelectedId] = useState("");
  const [tracks, setTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const [mode, setMode] = useState("local");

  const [totalRounds, setTotalRounds] = useState(10);
  const [snippetSeconds, setSnippetSeconds] = useState(1);

  const [deviceReady, setDeviceReady] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const [phase, setPhase] = useState("setup");

  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState([]);

  const [round, setRound] = useState(null);
  const [reveal, setReveal] = useState(null);

  const [isPlayingSnippet, setIsPlayingSnippet] =
    useState(false);

  const [timeLeftPct, setTimeLeftPct] = useState(100);
  const [guessWindowMs, setGuessWindowMs] =
    useState(12000);

  /*
   * =========================================================
   * SPOTIFY CONNECTION
   * =========================================================
   */

  useEffect(() => {
    captureSidFromUrl();

    api
      .authStatus()
      .then((res) => {
        setConnected(res.connected);
      })
      .catch(() => {
        setConnected(false);
      });
  }, []);

  /*
   * =========================================================
   * SPOTIFY PLAYER
   * =========================================================
   */

  useEffect(() => {
    if (!connected) return;

    let cancelled = false;

    createHostPlayer({
      onReady: (deviceId) => {
        if (cancelled) return;

        deviceIdRef.current = deviceId;
        setDeviceReady(true);
      },

      onError: (msg) => {
        setPlayerError(msg);
      },
    }).catch((err) => {
      setPlayerError(
        err.message ||
          "Failed to load Spotify player."
      );
    });

    return () => {
      cancelled = true;
    };
  }, [connected]);

  /*
   * =========================================================
   * LOAD PLAYLISTS
   * =========================================================
   */

  useEffect(() => {
    if (!connected) return;

    api
      .getPlaylists()
      .then((res) => {
        setPlaylists(res.playlists);
      })
      .catch((err) => {
        setConnectError(err.message);
      });

    api
      .getLikedSongsMeta()
      .then((res) => {
        setLikedCount(res.total);
      })
      .catch(() => {});
  }, [connected]);

  /*
   * =========================================================
   * TIMER
   * =========================================================
   */

  function clearGuessTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startGuessTimer(durationMs) {
    setGuessWindowMs(durationMs);
    setTimeLeftPct(100);

    const start = Date.now();

    clearGuessTimer();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;

      const pct = Math.max(
        0,
        100 -
          (elapsed / durationMs) * 100
      );

      setTimeLeftPct(pct);

      if (pct <= 0) {
        clearGuessTimer();
      }
    }, 100);
  }

  /*
   * =========================================================
   * SOCKET EVENTS
   * =========================================================
   */

  useEffect(() => {
    function onPlayersUpdated(list) {
      setPlayers(list);
    }

    function onRoundPrepare(payload) {
      setRound(payload);
      setPhase("round-active");
      setReveal(null);

      playSnippet(
        payload.track,
        payload.snippetMs
      );
    }

    function onGuessingOpen(info) {
      setPhase("guessing");

      setRound((r) =>
        r
          ? {
              ...r,
              ...info,
            }
          : info
      );

      startGuessTimer(
        info.guessWindowMs || 12000
      );
    }

    function onReveal(payload) {
      clearGuessTimer();

      setReveal(payload);
      setPlayers(payload.players);
      setPhase("reveal");
    }

    function onGameEnded(payload) {
      clearGuessTimer();

      setPlayers(payload.players);
      setPhase("ended");
    }

    socket.on(
      "room:players-updated",
      onPlayersUpdated
    );

    socket.on(
      "round:prepare",
      onRoundPrepare
    );

    socket.on(
      "round:guessing-open",
      onGuessingOpen
    );

    socket.on(
      "round:reveal",
      onReveal
    );

    socket.on(
      "game:ended",
      onGameEnded
    );

    return () => {
      socket.off(
        "room:players-updated",
        onPlayersUpdated
      );

      socket.off(
        "round:prepare",
        onRoundPrepare
      );

      socket.off(
        "round:guessing-open",
        onGuessingOpen
      );

      socket.off(
        "round:reveal",
        onReveal
      );

      socket.off(
        "game:ended",
        onGameEnded
      );

      clearGuessTimer();
    };

    // Socket instance intentionally remains stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * =========================================================
   * PLAYLIST
   * =========================================================
   */

  async function selectPlaylist(id) {
    setSelectedId(id);
    setTracks([]);
    setLoadingTracks(true);

    try {
      const res =
        id === "liked"
          ? await api.getLikedSongsTracks()
          : await api.getPlaylistTracks(id);

      setTracks(res.tracks);

      setTotalRounds(
        Math.min(
          10,
          res.tracks.length || 10
        )
      );
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setLoadingTracks(false);
    }
  }

  /*
   * =========================================================
   * CREATE ROOM
   * =========================================================
   */

  function createRoom() {
    socket.emit(
      "host:create-room",
      {
        mode,
        tracks,
        totalRounds,
        snippetMs:
          snippetSeconds * 1000,
      },
      (res) => {
        if (!res.ok) {
          setConnectError(res.error);
          return;
        }

        setRoomCode(res.roomCode);
        setPhase("lobby");
      }
    );
  }

  /*
   * =========================================================
   * HOST CONTROLS
   * =========================================================
   */

  function startGame() {
    socket.emit("host:start-game");
  }

  function nextRound() {
    socket.emit("host:next-round");
  }

  function revealNow() {
    socket.emit("host:reveal-now");
  }

  /*
   * =========================================================
   * SPOTIFY PLAYBACK
   * =========================================================
   */

  async function playSnippet(
    track,
    snippetMs
  ) {
    const deviceId = deviceIdRef.current;

    if (!deviceId) {
      setPlayerError(
        "Playback device isn't ready yet — give it a second and try again."
      );

      return;
    }

    try {
      setIsPlayingSnippet(true);

      const { accessToken } =
        await api.getToken();

      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",

          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            uris: [track.uri],
          }),
        }
      );

      setTimeout(async () => {
        try {
          const {
            accessToken: freshToken,
          } = await api.getToken();

          await fetch(
            `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
            {
              method: "PUT",

              headers: {
                Authorization: `Bearer ${freshToken}`,
              },
            }
          );
        } catch (err) {
          setPlayerError(
            "Couldn't pause playback: " +
              err.message
          );
        }

        setIsPlayingSnippet(false);

        socket.emit(
          "host:snippet-played"
        );
      }, snippetMs || 1000);
    } catch (err) {
      setIsPlayingSnippet(false);

      setPlayerError(
        "Couldn't play the track: " +
          err.message
      );
    }
  }

  /*
   * =========================================================
   * DERIVED DATA
   * =========================================================
   */

  const sortedPlayers = [
    ...players,
  ].sort(
    (a, b) => b.score - a.score
  );

  const visualizerState =
    isPlayingSnippet
      ? "listening"
      : phase === "guessing"
        ? "guessing"
        : phase === "reveal"
          ? "correct"
          : "idle";

  const inSession = [
    "lobby",
    "round-active",
    "guessing",
    "reveal",
    "ended",
  ].includes(phase);

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (connected === null) {
    return (
      <StudioScene mode="host">
        <div className="studio-loading-screen">
          <div className="studio-loading-orb" />

          <p className="hint">
            Checking Spotify connection…
          </p>
        </div>
      </StudioScene>
    );
  }

  /*
   * =========================================================
   * NOT CONNECTED
   * =========================================================
   */

  if (!connected) {
    return (
      <StudioScene mode="host">
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
            DJ CONTROL ROOM
          </div>
        </div>

        <div className="studio-auth-layout">
          <div className="studio-auth-copy">
            <span className="studio-kicker">
              HOST MODE
            </span>

            <h1>
              TAKE
              <br />
              THE
              <br />
              <span>DECKS.</span>
            </h1>

            <p>
              Connect Spotify to become the DJ,
              create a room, and control the
              entire session.
            </p>

            <a
              href={api.loginUrl()}
              className="studio-primary-button studio-primary-button--host"
            >
              <span>●</span>
              CONNECT SPOTIFY
            </a>

            {connectError && (
              <p className="error-text">
                {connectError}
              </p>
            )}

            <Link
              to="/"
              className="studio-back-link"
            >
              ← BACK TO HOME
            </Link>
          </div>

          <div className="studio-auth-record">
            <StudioTurntable
              mode="host"
              spinning={false}
            />
          </div>
        </div>
      </StudioScene>
    );
  }

  /*
   * =========================================================
   * SETUP
   * =========================================================
   */

  if (phase === "setup") {
    return (
      <StudioScene mode="host">
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
            DJ CONTROL ROOM
          </div>
        </div>

        <div className="studio-setup-layout">
          <div className="studio-setup-visual">
            <span className="studio-kicker">
              HOST SESSION
            </span>

            <h1>
              BUILD THE
              <br />
              <span>SET.</span>
            </h1>

            <p>
              Pick the music, tune the rules,
              then open the room.
            </p>

            <StudioTurntable
              mode="host"
              spinning={false}
            />

            <StudioWaveform
              state="idle"
            />
          </div>

          <div className="studio-setup-panel">
            <div className="studio-panel-header">
              <span>01</span>

              <h2>
                ROOM SETUP
              </h2>
            </div>

            {/* PLAYLIST */}

            <div className="studio-field">
              <label>
                PLAYLIST
              </label>

              <PlaylistPicker
                playlists={playlists}
                likedCount={likedCount}
                selectedId={selectedId}
                onSelect={selectPlaylist}
              />

              {loadingTracks && (
                <p className="studio-field-hint">
                  Loading tracks…
                </p>
              )}

              {!loadingTracks &&
                tracks.length > 0 && (
                  <p className="studio-field-hint">
                    {tracks.length} playable
                    tracks loaded.
                  </p>
                )}
            </div>

            {/* ROUNDS */}

            <div className="studio-field">
              <label htmlFor="host-rounds">
                ROUNDS
              </label>

              <select
                id="host-rounds"
                value={totalRounds}
                onChange={(e) =>
                  setTotalRounds(
                    Number(e.target.value)
                  )
                }
              >
                {ROUND_OPTIONS.filter(
                  (n) =>
                    n <=
                    (tracks.length ||
                      999)
                ).map((n) => (
                  <option
                    key={n}
                    value={n}
                  >
                    {n} rounds
                  </option>
                ))}

                {tracks.length > 0 && (
                  <option
                    value={tracks.length}
                  >
                    All {tracks.length}{" "}
                    tracks
                  </option>
                )}
              </select>
            </div>

            {/* SNIPPET */}

            <div className="studio-field">
              <label htmlFor="host-snippet">
                SNIPPET LENGTH
              </label>

              <select
                id="host-snippet"
                value={snippetSeconds}
                onChange={(e) =>
                  setSnippetSeconds(
                    Number(e.target.value)
                  )
                }
              >
                {SNIPPET_OPTIONS.map(
                  (opt) => (
                    <option
                      key={opt.seconds}
                      value={opt.seconds}
                    >
                      {opt.label} ·{" "}
                      {opt.multiplier} points
                    </option>
                  )
                )}
              </select>

              <p className="studio-field-hint">
                Shorter snippets are harder
                to guess, so correct answers
                are worth more.
              </p>
            </div>

            {/* PLAYBACK MODE */}

            <div className="studio-field">
              <label htmlFor="host-mode">
                PLAYBACK MODE
              </label>

              <select
                id="host-mode"
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value)
                }
              >
                <option value="local">
                  Out loud from this device
                </option>

                <option value="remote">
                  Players are remote
                  (v2 — best effort for now)
                </option>
              </select>
            </div>

            {/* CREATE */}

            <button
              className="studio-primary-button studio-primary-button--full studio-primary-button--host"
              disabled={
                !tracks.length ||
                !deviceReady
              }
              onClick={createRoom}
            >
              {deviceReady
                ? "CREATE ROOM"
                : "CONNECTING TO SPOTIFY PLAYER…"}
            </button>

            {playerError && (
              <p className="error-text">
                {playerError}
              </p>
            )}

            {connectError && (
              <p className="error-text">
                {connectError}
              </p>
            )}

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

  /*
   * =========================================================
   * LOBBY
   * =========================================================
   */

  if (phase === "lobby") {
    return (
      <StudioScene mode="host">
        <ConnectionBadge
          socket={socket}
        />

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
            ROOM OPEN
          </div>
        </div>

        <div className="studio-lobby-layout">
          <div className="studio-lobby-hero">
            <span className="studio-kicker">
              WAITING ROOM
            </span>

            <h1>
              GET YOUR
              <br />
              <span>CREW</span>
              <br />
              READY.
            </h1>

            <p>
              Send the room code to your players.
              When everyone is in, start the
              session.
            </p>

            <StudioTurntable
              mode="host"
              spinning={false}
            />
          </div>

          <div className="studio-room-panel">
            <div className="studio-room-label">
              ROOM CODE
            </div>

            <div className="studio-room-code">
              {roomCode}
            </div>

            <p className="studio-room-help">
              Go to <strong>Join</strong> and
              enter this code.
            </p>

            <div className="studio-panel-divider" />

            <div className="studio-player-heading">
              <span>
                PLAYERS
              </span>

              <strong>
                {players.length}
              </strong>
            </div>

            {players.length === 0 ? (
              <div className="studio-empty-players">
                <div className="studio-waiting-orb" />

                <p>
                  Waiting for players
                  <span className="studio-dots">
                    ...
                  </span>
                </p>
              </div>
            ) : (
              <div className="studio-player-list">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className="studio-player-row"
                  >
                    <span className="studio-player-rank">
                      {String(
                        index + 1
                      ).padStart(2, "0")}
                    </span>

                    <span className="studio-player-name">
                      {player.name}
                    </span>

                    <span className="studio-player-status">
                      READY
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              className="studio-primary-button studio-primary-button--full studio-primary-button--host"
              disabled={
                players.length === 0
              }
              onClick={startGame}
            >
              START GAME
            </button>
          </div>
        </div>
      </StudioScene>
    );
  }

  /*
   * =========================================================
   * ROUND ACTIVE / GUESSING
   * =========================================================
   */

  if (
    phase === "round-active" ||
    phase === "guessing"
  ) {
    return (
      <StudioScene mode="host">
        <ConnectionBadge
          socket={socket}
        />

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
            DJ CONTROL ROOM
          </div>
        </div>

        <StudioHUD
          score={
            sortedPlayers[0]?.score ||
            0
          }
          round={
            round?.roundNumber || 1
          }
          totalRounds={
            round?.totalRounds ||
            totalRounds
          }
          streak={0}
        />

        <div className="studio-host-game-layout">
          <div className="studio-host-game-copy">
            <span className="studio-kicker">
              {phase === "round-active"
                ? "NOW PLAYING"
                : "GUESSING OPEN"}
            </span>

            <h1>
              {phase ===
              "round-active" ? (
                <>
                  DROP
                  <br />
                  THE
                  <br />
                  <span>TRACK.</span>
                </>
              ) : (
                <>
                  LET THEM
                  <br />
                  <span>GUESS.</span>
                </>
              )}
            </h1>

            <p>
              {phase ===
              "round-active"
                ? "Everyone is listening. The answer window opens when the snippet ends."
                : "Players are making their guesses. Watch the leaderboard and reveal when you're ready."}
            </p>
          </div>

          <div className="studio-host-turntable">
            <StudioTurntable
              mode="host"
              spinning={
                isPlayingSnippet
              }
            />

            <StudioWaveform
              state={
                visualizerState
              }
            />

            <div className="studio-live-indicator">
              <span />
              {isPlayingSnippet
                ? "PLAYING"
                : "LIVE SESSION"}
            </div>
          </div>

          <div className="studio-host-score-panel">
            <div className="studio-score-panel-header">
              <span>
                LIVE LEADERBOARD
              </span>

              <span>
                {roomCode}
              </span>
            </div>

            <div className="studio-live-players">
              {sortedPlayers.length ===
              0 ? (
                <p className="studio-field-hint">
                  Waiting for players…
                </p>
              ) : (
                sortedPlayers.map(
                  (player, index) => (
                    <div
                      key={player.id}
                      className={`studio-live-player ${
                        index === 0
                          ? "studio-live-player--leader"
                          : ""
                      }`}
                    >
                      <div className="studio-live-player__identity">
                        <span className="studio-live-player__rank">
                          #{index + 1}
                        </span>

                        <span className="studio-live-player__name">
                          {player.name}
                        </span>
                      </div>

                      <strong>
                        {player.score}
                      </strong>
                    </div>
                  )
                )
              )}
            </div>

            {phase === "guessing" && (
              <div className="studio-host-timer">
                <div className="studio-host-timer__top">
                  <span>
                    GUESS WINDOW
                  </span>

                  <strong>
                    {Math.ceil(
                      (timeLeftPct /
                        100) *
                        (guessWindowMs /
                          1000)
                    )}
                    s
                  </strong>
                </div>

                <div className="studio-timer__track">
                  <div
                    className="studio-timer__fill studio-timer__fill--host"
                    style={{
                      width: `${timeLeftPct}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {phase === "guessing" && (
              <button
                className="studio-secondary-button"
                onClick={revealNow}
              >
                REVEAL ANSWER
              </button>
            )}

            {playerError && (
              <p className="error-text">
                {playerError}
              </p>
            )}
          </div>
        </div>
      </StudioScene>
    );
  }

  /*
   * =========================================================
   * REVEAL
   * =========================================================
   */

  if (
    phase === "reveal" &&
    reveal
  ) {
    return (
      <StudioScene mode="host">
        <ConnectionBadge
          socket={socket}
        />

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
            TRACK REVEALED
          </div>
        </div>

        <StudioHUD
          score={
            sortedPlayers[0]?.score ||
            0
          }
          round={
            reveal.roundNumber
          }
          totalRounds={
            reveal.totalRounds
          }
          streak={0}
        />

        <div className="studio-reveal-layout">
          <div className="studio-reveal-copy">
            <span className="studio-kicker">
              ANSWER
            </span>

            <h1>
              THAT
              <br />
              WAS
              <br />
              <span>THE DROP.</span>
            </h1>

            <StudioTurntable
              mode="host"
              stopping
            />

            <StudioWaveform
              state="correct"
            />
          </div>

          <div className="studio-reveal-panel">
            {reveal.track?.image && (
              <img
                className="studio-reveal-art"
                src={
                  reveal.track.image
                }
                alt=""
              />
            )}

            <div className="studio-reveal-label">
              THE TRACK WAS
            </div>

            <h2 className="studio-reveal-title">
              {reveal.track?.name}
            </h2>

            <p className="studio-reveal-artist">
              {reveal.track?.artists}
            </p>

            <div className="studio-panel-divider" />

            <div className="studio-player-heading">
              <span>
                LEADERBOARD
              </span>

              <strong>
                {players.length}
              </strong>
            </div>

            <div className="studio-player-list">
              {sortedPlayers.map(
                (player, index) => (
                  <div
                    key={player.id}
                    className={`studio-player-row ${
                      index === 0
                        ? "studio-player-row--leader"
                        : ""
                    }`}
                  >
                    <span className="studio-player-rank">
                      #{index + 1}
                    </span>

                    <span className="studio-player-name">
                      {player.name}
                    </span>

                    <strong>
                      {player.score}
                    </strong>
                  </div>
                )
              )}
            </div>

            <button
              className="studio-primary-button studio-primary-button--full studio-primary-button--host"
              onClick={nextRound}
            >
              {reveal.isLastRound
                ? "SEE FINAL SCORES"
                : "NEXT ROUND →"}
            </button>
          </div>
        </div>
      </StudioScene>
    );
  }

  /*
   * =========================================================
   * ENDED
   * =========================================================
   */

  if (phase === "ended") {
    return (
      <StudioScene mode="host">
        <ConnectionBadge
          socket={socket}
        />

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
            END OF SET
          </div>
        </div>

        <div className="studio-ended-layout">
          <div className="studio-ended-copy">
            <span className="studio-kicker">
              SESSION COMPLETE
            </span>

            <h1>
              THAT'S A
              <br />
              <span>WRAP.</span>
            </h1>

            <p>
              The room has gone quiet.
              Here's how your crew finished
              the set.
            </p>
          </div>

          <StudioTurntable
            mode="host"
            stopping
          />

          <div className="studio-final-score studio-final-score--leaderboard">
            <div className="studio-final-score__header">
              <span>
                FINAL LEADERBOARD
              </span>

              <span>
                {roomCode}
              </span>
            </div>

            <div className="studio-final-leaderboard">
              {sortedPlayers.map(
                (player, index) => (
                  <div
                    key={player.id}
                    className={`studio-final-player ${
                      index === 0
                        ? "studio-final-player--winner"
                        : ""
                    }`}
                  >
                    <span className="studio-final-player__rank">
                      #{index + 1}
                    </span>

                    <span className="studio-final-player__name">
                      {player.name}
                    </span>

                    <strong>
                      {player.score}
                    </strong>
                  </div>
                )
              )}
            </div>
          </div>

          <Link
            to="/"
            className="studio-back-link"
          >
            ← BACK TO HOME
          </Link>
        </div>
      </StudioScene>
    );
  }

  return null;
}