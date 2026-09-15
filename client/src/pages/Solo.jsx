import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

import { api, captureSidFromUrl } from "../lib/api";
import { createHostPlayer } from "../lib/spotifyPlayer";
import {
  isCorrectGuess,
  scoreForElapsed,
  difficultyMultiplier,
} from "../lib/matcher";

import StudioScene from "../components/StudioScene";
import StudioTurntable from "../components/StudioTurntable";
import StudioHUD from "../components/StudioHUD";
import StudioWaveform from "../components/StudioWaveform";

const ROUND_OPTIONS = [5, 10, 15, 20, 25, 30];

const SNIPPET_OPTIONS = [
  { seconds: 1, multiplier: "2.0x", label: "1 second — brutal" },
  { seconds: 2, multiplier: "1.5x", label: "2 seconds — hard" },
  { seconds: 3, multiplier: "1.2x", label: "3 seconds — medium" },
  { seconds: 5, multiplier: "1.0x", label: "5 seconds — easy" },
  { seconds: 10, multiplier: "0.7x", label: "10 seconds — very easy" },
];

const GUESS_WINDOW_MS = 12_000;

function shuffle(arr) {
  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

export default function Solo() {
  const [params] = useSearchParams();

  const deviceIdRef = useRef(null);
  const timerRef = useRef(null);

  const [connected, setConnected] = useState(null);
  const [connectError, setConnectError] = useState(
    params.get("error") || ""
  );

  const [playlists, setPlaylists] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [tracks, setTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const [totalRounds, setTotalRounds] = useState(10);
  const [snippetSeconds, setSnippetSeconds] = useState(1);

  const [deviceReady, setDeviceReady] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const [phase, setPhase] = useState("setup");
  const [gameTracks, setGameTracks] = useState([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);

  const [isPlayingSnippet, setIsPlayingSnippet] = useState(false);
  const [guessingOpenedAt, setGuessingOpenedAt] = useState(null);
  const [timeLeftPct, setTimeLeftPct] = useState(100);

  const [guess, setGuess] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [feedback, setFeedback] = useState(null);
  const [revealInfo, setRevealInfo] = useState(null);

  const snippetMs = snippetSeconds * 1000;
  const currentTrack = gameTracks[roundIndex] || null;

  /*
   * ---------------------------------------------------------
   * SPOTIFY AUTH STATUS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    captureSidFromUrl();

    api
      .authStatus()
      .then((res) => setConnected(res.connected))
      .catch(() => setConnected(false));
  }, []);

  /*
   * ---------------------------------------------------------
   * SPOTIFY PLAYER
   * ---------------------------------------------------------
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
        err.message || "Failed to load Spotify player."
      );
    });

    return () => {
      cancelled = true;
    };
  }, [connected]);

  /*
   * ---------------------------------------------------------
   * PLAYLISTS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!connected) return;

    api
      .getPlaylists()
      .then((res) => setPlaylists(res.playlists))
      .catch((err) => setConnectError(err.message));
  }, [connected]);

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
        Math.min(10, res.tracks.length || 10)
      );
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setLoadingTracks(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * START GAME
   * ---------------------------------------------------------
   */

  function startGame() {
    const picked = shuffle(tracks).slice(
      0,
      totalRounds
    );

    setGameTracks(picked);
    setRoundIndex(0);
    setScore(0);
    setFeedback(null);
    setGuess("");
    setRevealInfo(null);
    setPhase("round-active");

    playSnippet(picked[0]);
  }

  /*
   * ---------------------------------------------------------
   * PLAY SNIPPET
   * ---------------------------------------------------------
   */

  async function playSnippet(track) {
    const deviceId = deviceIdRef.current;

    if (!deviceId || !track) {
      setPlayerError(
        "Playback device isn't ready yet — give it a second and try again."
      );
      return;
    }

    try {
      setIsPlayingSnippet(true);

      const { accessToken } = await api.getToken();

      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: [track.uri],
          }),
        }
      );

      setTimeout(async () => {
        try {
          const { accessToken: freshToken } =
            await api.getToken();

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
            "Couldn't pause playback: " + err.message
          );
        }

        setIsPlayingSnippet(false);
        openGuessing();
      }, snippetMs || 1000);
    } catch (err) {
      setIsPlayingSnippet(false);

      setPlayerError(
        "Couldn't play the track: " + err.message
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * GUESSING TIMER
   * ---------------------------------------------------------
   */

  function openGuessing() {
    setPhase("guessing");
    setGuessingOpenedAt(Date.now());
    setTimeLeftPct(100);

    clearTimer();

    const start = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;

      const pct = Math.max(
        0,
        100 - (elapsed / GUESS_WINDOW_MS) * 100
      );

      setTimeLeftPct(pct);

      if (pct <= 0) {
        clearTimer();
        revealRound(null);
      }
    }, 100);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  /*
   * ---------------------------------------------------------
   * SUBMIT GUESS
   * ---------------------------------------------------------
   */

  function submitGuess(e) {
    e.preventDefault();

    if (
      !guess.trim() ||
      feedback?.correct ||
      !currentTrack
    ) {
      return;
    }

    setShowSuggestions(false);

    const correct = isCorrectGuess(
      guess.trim(),
      currentTrack.name
    );

    if (correct) {
      const elapsedMs =
        Date.now() - guessingOpenedAt;

      const points = Math.round(
        scoreForElapsed(elapsedMs) *
          difficultyMultiplier(snippetMs)
      );

      setScore((s) => s + points);

      setFeedback({
        correct: true,
        points,
      });

      revealRound(points);
    } else {
      setFeedback({
        correct: false,
      });
    }
  }

  /*
   * ---------------------------------------------------------
   * REVEAL
   * ---------------------------------------------------------
   */

  function revealRound(points) {
    clearTimer();

    setRevealInfo({
      track: currentTrack,
      gotItRight: points != null,
      points: points || 0,
    });

    setPhase("reveal");
  }

  /*
   * ---------------------------------------------------------
   * NEXT ROUND
   * ---------------------------------------------------------
   */

  function nextRound() {
    const next = roundIndex + 1;

    if (next >= gameTracks.length) {
      setPhase("ended");
      return;
    }

    setRoundIndex(next);
    setFeedback(null);
    setGuess("");
    setRevealInfo(null);
    setPhase("round-active");

    playSnippet(gameTracks[next]);
  }

  /*
   * ---------------------------------------------------------
   * AUTOCOMPLETE
   * ---------------------------------------------------------
   */

  function selectSuggestion(name) {
    setGuess(name);
    setShowSuggestions(false);
  }

  const suggestions = useMemo(() => {
    const q = guess.trim().toLowerCase();

    if (q.length < 2) return [];

    return tracks
      .filter((t) =>
        t.name.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [guess, tracks]);

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (connected === null) {
    return (
      <StudioScene mode="solo">
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
      <StudioScene mode="solo">
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
            PRIVATE LISTENING BOOTH
          </div>
        </div>

        <div className="studio-auth-layout">
          <div className="studio-auth-copy">
            <span className="studio-kicker">
              SOLO MODE
            </span>

            <h1>
              YOUR
              <br />
              <span>PRIVATE</span>
              <br />
              SESSION.
            </h1>

            <p>
              Connect Spotify and step into your
              private listening booth.
            </p>

            <a
              href={api.loginUrl()}
              className="studio-primary-button"
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
              mode="solo"
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
      <StudioScene mode="solo">
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
            PRIVATE LISTENING BOOTH
          </div>
        </div>

        <div className="studio-setup-layout">
          <div className="studio-setup-visual">
            <span className="studio-kicker">
              SOLO SESSION
            </span>

            <h1>
              SET THE
              <br />
              <span>VIBE.</span>
            </h1>

            <p>
              Pick your playlist, choose the
              difficulty, then trust your ears.
            </p>

            <StudioTurntable
              mode="solo"
              spinning={false}
            />

            <StudioWaveform state="idle" />
          </div>

          <div className="studio-setup-panel">
            <div className="studio-panel-header">
              <span>01</span>
              <h2>SESSION SETUP</h2>
            </div>

            {/* PLAYLIST */}

            <div className="studio-field">
              <label htmlFor="playlist">
                PLAYLIST
              </label>

              <select
                id="playlist"
                value={selectedId}
                onChange={(e) =>
                  selectPlaylist(e.target.value)
                }
              >
                <option
                  value=""
                  disabled
                >
                  Choose a playlist…
                </option>

                <option value="liked">
                  Liked Songs
                </option>

                {playlists.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name} ({p.trackCount})
                  </option>
                ))}
              </select>

              {loadingTracks && (
                <p className="studio-field-hint">
                  Loading tracks…
                </p>
              )}

              {!loadingTracks &&
                tracks.length > 0 && (
                  <p className="studio-field-hint">
                    {tracks.length} playable tracks
                    loaded.
                  </p>
                )}
            </div>

            {/* ROUNDS */}

            <div className="studio-field">
              <label htmlFor="rounds">
                ROUNDS
              </label>

              <select
                id="rounds"
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
                    (tracks.length || 999)
                ).map((n) => (
                  <option
                    key={n}
                    value={n}
                  >
                    {n} rounds
                  </option>
                ))}

                {tracks.length > 0 && (
                  <option value={tracks.length}>
                    All {tracks.length} tracks
                  </option>
                )}
              </select>
            </div>

            {/* SNIPPET */}

            <div className="studio-field">
              <label htmlFor="snippet">
                SNIPPET LENGTH
              </label>

              <select
                id="snippet"
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
                Shorter snippets are harder to
                guess, so correct answers are
                worth more.
              </p>
            </div>

            {/* START */}

            <button
              className="studio-primary-button studio-primary-button--full"
              disabled={
                !tracks.length ||
                !deviceReady
              }
              onClick={startGame}
            >
              {deviceReady
                ? "START SESSION"
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
   * ROUND ACTIVE — LISTENING
   * =========================================================
   */

  if (phase === "round-active") {
    return (
      <StudioScene mode="solo">
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
            LISTENING SESSION
          </div>
        </div>

        <StudioHUD
          score={score}
          round={roundIndex + 1}
          totalRounds={gameTracks.length}
          streak={0}
        />

        <div className="studio-listening-layout">
          <div className="studio-listening-label">
            <span>ROUND {roundIndex + 1}</span>

            <h1>
              TRUST
              <br />
              YOUR <span>EARS.</span>
            </h1>

            <p>
              Listen closely. The clock starts
              when the music stops.
            </p>
          </div>

          <StudioTurntable
            mode="solo"
            spinning={isPlayingSnippet}
            stopping={false}
          />

          <div className="studio-listening-status">
            <StudioWaveform state="listening" />

            <div className="studio-status-dot">
              <span />
              PLAYING SNIPPET
            </div>

            <p>
              {snippetSeconds} second
              {snippetSeconds !== 1
                ? "s"
                : ""}{" "}
              of audio
            </p>
          </div>
        </div>
      </StudioScene>
    );
  }

  /*
   * =========================================================
   * GUESSING
   * =========================================================
   */

  if (phase === "guessing") {
    return (
      <StudioScene mode="solo">
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
            GUESS THE TRACK
          </div>
        </div>

        <StudioHUD
          score={score}
          round={roundIndex + 1}
          totalRounds={gameTracks.length}
          streak={0}
        />

        <div className="studio-guess-layout">
          <div className="studio-guess-visual">
            <StudioTurntable
              mode="solo"
              spinning={false}
            />

            <StudioWaveform state="guessing" />

            <div className="studio-guess-prompt">
              WHAT'S
              <br />
              THE <span>SONG?</span>
            </div>
          </div>

          <div className="studio-guess-panel">
            <div className="studio-timer">
              <div className="studio-timer__top">
                <span>
                  TIME REMAINING
                </span>

                <strong>
                  {Math.ceil(
                    (GUESS_WINDOW_MS *
                      (timeLeftPct / 100)) /
                      1000
                  )}
                  s
                </strong>
              </div>

              <div className="studio-timer__track">
                <div
                  className="studio-timer__fill"
                  style={{
                    width: `${timeLeftPct}%`,
                  }}
                />
              </div>
            </div>

            <form
              onSubmit={submitGuess}
              autoComplete="off"
            >
              <label
                htmlFor="guess"
                className="studio-input-label"
              >
                ENTER YOUR GUESS
              </label>

              <div className="studio-input-wrap">
                <input
                  id="guess"
                  type="text"
                  value={guess}
                  onChange={(e) => {
                    setGuess(
                      e.target.value
                    );
                    setShowSuggestions(true);
                  }}
                  onFocus={() =>
                    setShowSuggestions(true)
                  }
                  onBlur={() =>
                    setTimeout(
                      () =>
                        setShowSuggestions(
                          false
                        ),
                      150
                    )
                  }
                  placeholder="Start typing a song title…"
                  disabled={feedback?.correct}
                  autoFocus
                />

                {showSuggestions &&
                  suggestions.length >
                    0 && (
                    <div className="studio-suggestions">
                      {suggestions.map(
                        (t) => (
                          <button
                            type="button"
                            key={t.id}
                            className="studio-suggestion"
                            onMouseDown={() =>
                              selectSuggestion(
                                t.name
                              )
                            }
                          >
                            {t.image && (
                              <img
                                src={t.image}
                                alt=""
                              />
                            )}

                            <span>
                              <strong>
                                {t.name}
                              </strong>

                              <small>
                                {t.artists}
                              </small>
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  )}
              </div>

              <button
                className="studio-primary-button studio-primary-button--full"
                disabled={
                  feedback?.correct ||
                  !guess.trim()
                }
              >
                SUBMIT GUESS
              </button>
            </form>

            {feedback &&
              !feedback.correct && (
                <div className="studio-wrong-message">
                  <span>×</span>
                  NOT QUITE — TRY AGAIN
                </div>
              )}

            <div className="studio-trust">
              TRUST YOUR EARS
            </div>
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
    revealInfo
  ) {
    const correct =
      revealInfo.gotItRight;

    return (
      <StudioScene mode="solo">
        <div
          className={`studio-result-scene ${
            correct
              ? "studio-result-scene--correct"
              : "studio-result-scene--wrong"
          }`}
        >
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
              {correct
                ? "TRACK IDENTIFIED"
                : "TRACK REVEALED"}
            </div>
          </div>

          <StudioHUD
            score={score}
            round={roundIndex + 1}
            totalRounds={gameTracks.length}
            streak={0}
          />

          <div className="studio-reveal-layout">
            <StudioTurntable
              mode="solo"
              spinning={false}
              stopping={true}
            />

            <StudioWaveform
              state={
                correct
                  ? "correct"
                  : "wrong"
              }
            />

            <div
              className={`studio-result-badge ${
                correct
                  ? "studio-result-badge--correct"
                  : "studio-result-badge--wrong"
              }`}
            >
              {correct
                ? "CORRECT"
                : "TIME'S UP"}
            </div>

            <div className="studio-track-card">
              {revealInfo.track.image && (
                <img
                  src={revealInfo.track.image}
                  alt=""
                />
              )}

              <div>
                <span>
                  THE TRACK WAS
                </span>

                <h2>
                  {revealInfo.track.name}
                </h2>

                <p>
                  {revealInfo.track.artists}
                </p>
              </div>
            </div>

            <p
              className={`studio-result-points ${
                correct
                  ? "studio-result-points--correct"
                  : "studio-result-points--wrong"
              }`}
            >
              {correct
                ? `+${revealInfo.points} POINTS`
                : "NO POINTS"}
            </p>

            <button
              className="studio-primary-button"
              onClick={nextRound}
            >
              {roundIndex + 1 >=
              gameTracks.length
                ? "SEE FINAL SCORE"
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
      <StudioScene mode="solo">
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
              You made it through{" "}
              {gameTracks.length} rounds
              using {snippetSeconds}s
              snippets.
            </p>
          </div>

          <StudioTurntable
            mode="solo"
            stopping={true}
          />

          <div className="studio-final-score">
            <span>FINAL SCORE</span>

            <strong>
              {score}
            </strong>

            <small>
              {gameTracks.length} ROUNDS
              <br />
              {snippetSeconds}S SNIPPETS
            </small>
          </div>

          <div className="studio-ended-actions">
            <button
              className="studio-primary-button"
              onClick={() =>
                setPhase("setup")
              }
            >
              PLAY AGAIN
            </button>

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

  return null;
}