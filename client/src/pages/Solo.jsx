import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, captureSidFromUrl } from "../lib/api";
import { createHostPlayer } from "../lib/spotifyPlayer";
import { isCorrectGuess, scoreForElapsed, difficultyMultiplier } from "../lib/matcher";
import Turntable from "../components/Turntable.jsx";

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
  const [connectError, setConnectError] = useState(params.get("error") || "");

  const [playlists, setPlaylists] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [tracks, setTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const [totalRounds, setTotalRounds] = useState(10);
  const [snippetSeconds, setSnippetSeconds] = useState(1);

  const [deviceReady, setDeviceReady] = useState(false);
  const [playerError, setPlayerError] = useState("");

  const [phase, setPhase] = useState("setup"); // setup | round-active | guessing | reveal | ended
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

  // ---------- Spotify connection ----------
  useEffect(() => {
    captureSidFromUrl();
    api
      .authStatus()
      .then((res) => setConnected(res.connected))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    createHostPlayer({
      onReady: (deviceId) => {
        if (cancelled) return;
        deviceIdRef.current = deviceId;
        setDeviceReady(true);
      },
      onError: (msg) => setPlayerError(msg),
    }).catch((err) => setPlayerError(err.message || "Failed to load Spotify player."));
    return () => {
      cancelled = true;
    };
  }, [connected]);

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
        id === "liked" ? await api.getLikedSongsTracks() : await api.getPlaylistTracks(id);
      setTracks(res.tracks);
      setTotalRounds(Math.min(10, res.tracks.length || 10));
    } catch (err) {
      setConnectError(err.message);
    } finally {
      setLoadingTracks(false);
    }
  }

  function startGame() {
    const picked = shuffle(tracks).slice(0, totalRounds);
    setGameTracks(picked);
    setRoundIndex(0);
    setScore(0);
    setFeedback(null);
    setGuess("");
    setRevealInfo(null);
    setPhase("round-active");
    playSnippet(picked[0]);
  }

  async function playSnippet(track) {
    const deviceId = deviceIdRef.current;
    if (!deviceId || !track) {
      setPlayerError("Playback device isn't ready yet — give it a second and try again.");
      return;
    }
    try {
      setIsPlayingSnippet(true);
      const { accessToken } = await api.getToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [track.uri] }),
      });

      setTimeout(async () => {
        try {
          const { accessToken: freshToken } = await api.getToken();
          await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${freshToken}` },
          });
        } catch (err) {
          setPlayerError("Couldn't pause playback: " + err.message);
        }
        setIsPlayingSnippet(false);
        // Track is threaded explicitly through the chain rather than read
        // from the component closure — avoids the stale-closure bug where
        // a timeout could reveal the previous round's track.
        openGuessing(track);
      }, snippetMs || 1000);
    } catch (err) {
      setIsPlayingSnippet(false);
      setPlayerError("Couldn't play the track: " + err.message);
    }
  }

  function openGuessing(track) {
    setPhase("guessing");
    setGuessingOpenedAt(Date.now());
    setTimeLeftPct(100);
    clearTimer();
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / GUESS_WINDOW_MS) * 100);
      setTimeLeftPct(pct);
      if (pct <= 0) {
        clearTimer();
        revealRound(null, track);
      }
    }, 100);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function submitGuess(e) {
    e.preventDefault();
    if (!guess.trim() || feedback?.correct || !currentTrack) return;
    setShowSuggestions(false);

    const correct = isCorrectGuess(guess.trim(), currentTrack.name);
    if (correct) {
      const elapsedMs = Date.now() - guessingOpenedAt;
      const points = Math.round(scoreForElapsed(elapsedMs) * difficultyMultiplier(snippetMs));
      setScore((s) => s + points);
      setFeedback({ correct: true, points });
      revealRound(points, currentTrack);
    } else {
      setFeedback({ correct: false });
    }
  }

  function revealRound(points, track) {
    clearTimer();
    setRevealInfo({
      track: track || currentTrack,
      gotItRight: points != null,
      points: points || 0,
    });
    setPhase("reveal");
  }

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

  function selectSuggestion(name) {
    setGuess(name);
    setShowSuggestions(false);
  }

  const suggestions = useMemo(() => {
    const q = guess.trim().toLowerCase();
    if (q.length < 2) return [];
    return tracks.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6);
  }, [guess, tracks]);

  // ---------- Render ----------

  if (connected === null) {
    return (
      <div className="screen">
        <p className="hint">Checking Spotify connection…</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="screen">
        <div className="brand">
          <span className="brand-mark">SOLO PLAY</span>
        </div>
        <p className="subtitle">
          Connect your Spotify account to play by yourself — no room, no
          friends needed. You'll need Spotify Premium for playback.
        </p>
        <a href={api.loginUrl()} className="btn btn-primary">
          Connect Spotify
        </a>
        {connectError && <p className="error-text">{connectError}</p>}
        <Link to="/" className="hint" style={{ marginTop: 24 }}>
          ← Back
        </Link>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="screen">
        <div className="brand">
          <span className="brand-mark">SOLO PLAY</span>
        </div>
        <p className="subtitle">Pick a playlist and tune your settings.</p>

        <div className="card">
          <label>Playlist</label>
          <select value={selectedId} onChange={(e) => selectPlaylist(e.target.value)}>
            <option value="" disabled>
              Choose a playlist…
            </option>
            <option value="liked">Liked Songs</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.trackCount})
              </option>
            ))}
          </select>

          {loadingTracks && <p className="hint" style={{ marginTop: 12 }}>Loading tracks…</p>}
          {!loadingTracks && tracks.length > 0 && (
            <p className="hint" style={{ marginTop: 12 }}>
              {tracks.length} playable tracks loaded.
            </p>
          )}

          <div style={{ marginTop: 20 }}>
            <label>Rounds</label>
            <select value={totalRounds} onChange={(e) => setTotalRounds(Number(e.target.value))}>
              {ROUND_OPTIONS.filter((n) => n <= (tracks.length || 999)).map((n) => (
                <option key={n} value={n}>
                  {n} rounds
                </option>
              ))}
              {tracks.length > 0 && (
                <option value={tracks.length}>All {tracks.length} tracks</option>
              )}
            </select>
          </div>

          <div style={{ marginTop: 20 }}>
            <label>Snippet length</label>
            <select
              value={snippetSeconds}
              onChange={(e) => setSnippetSeconds(Number(e.target.value))}
            >
              {SNIPPET_OPTIONS.map((opt) => (
                <option key={opt.seconds} value={opt.seconds}>
                  {opt.label} · {opt.multiplier} points
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 24 }}
            disabled={!tracks.length || !deviceReady}
            onClick={startGame}
          >
            {deviceReady ? "Start playing" : "Connecting to Spotify player…"}
          </button>
          {playerError && <p className="error-text">{playerError}</p>}
          {connectError && <p className="error-text">{connectError}</p>}
        </div>

        <Link to="/" className="hint" style={{ marginTop: 20 }}>
          ← Back
        </Link>
      </div>
    );
  }

  if (phase === "round-active") {
    return (
      <div className="screen">
        <div className="badge" style={{ marginBottom: 20 }}>
          Round {roundIndex + 1}/{gameTracks.length} · Score {score}
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <Turntable spinning size={170} />
          <h3 className="section-title">Playing snippet…</h3>
          <p className="hint">Listen closely.</p>
        </div>
      </div>
    );
  }

  if (phase === "guessing") {
    return (
      <div className="screen">
        <div className="badge" style={{ marginBottom: 20 }}>
          Round {roundIndex + 1}/{gameTracks.length} · Score {score}
        </div>
        <div className="card">
          <div className="timer-bar">
            <div className="timer-bar-fill" style={{ width: `${timeLeftPct}%` }} />
          </div>
          <form onSubmit={submitGuess} autoComplete="off">
            <label htmlFor="guess">What's the song?</label>
            <div style={{ position: "relative" }}>
              <input
                id="guess"
                type="text"
                value={guess}
                onChange={(e) => {
                  setGuess(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Start typing a song title…"
                disabled={feedback?.correct}
                autoFocus
                style={{ marginBottom: showSuggestions && suggestions.length ? 4 : 14 }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="card"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    padding: 6,
                    marginBottom: 14,
                  }}
                >
                  {suggestions.map((t) => (
                    <div
                      key={t.id}
                      className="track-row"
                      onMouseDown={() => selectSuggestion(t.name)}
                    >
                      {t.image && <img src={t.image} alt="" />}
                      <div className="meta">
                        <div className="name">{t.name}</div>
                        <div className="artist">{t.artists}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {(!showSuggestions || suggestions.length === 0) && <div style={{ marginBottom: 14 }} />}
            <button
              className="btn btn-primary btn-block"
              disabled={feedback?.correct || !guess.trim()}
            >
              Submit guess
            </button>
          </form>
          {feedback && !feedback.correct && (
            <p className="center-note" style={{ color: "#e0554f" }}>
              Not quite — try again
            </p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "reveal" && revealInfo) {
    return (
      <div className="screen">
        <div className="badge" style={{ marginBottom: 20 }}>
          Round {roundIndex + 1}/{gameTracks.length} · Score {score}
        </div>
        <div className="card">
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
            {revealInfo.track.image && (
              <img
                src={revealInfo.track.image}
                alt=""
                style={{ width: 64, height: 64, borderRadius: 8 }}
              />
            )}
            <div>
              <div style={{ fontWeight: 700 }}>{revealInfo.track.name}</div>
              <div className="hint">{revealInfo.track.artists}</div>
            </div>
          </div>
          <p
            className="center-note"
            style={{ color: revealInfo.gotItRight ? "#3fb8af" : "#e0554f", marginBottom: 4 }}
          >
            {revealInfo.gotItRight ? `Correct! +${revealInfo.points} points` : "Time's up!"}
          </p>
          <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={nextRound}>
            {roundIndex + 1 >= gameTracks.length ? "See final score" : "Next round"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="screen">
        <div className="brand">
          <span className="brand-mark">FINAL SCORE</span>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="room-code-label">You scored</div>
          <div className="room-code">{score}</div>
          <p className="hint">
            {gameTracks.length} rounds · {snippetSeconds}s snippets
          </p>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 20 }}
            onClick={() => setPhase("setup")}
          >
            Play again
          </button>
        </div>
        <Link to="/" className="hint" style={{ marginTop: 20 }}>
          ← Back to home
        </Link>
      </div>
    );
  }

  return null;
}