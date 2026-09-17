import { useRef } from "react";
import { Link } from "react-router-dom";
import Turntable from "../components/Turntable.jsx";
import Visualizer from "../components/Visualizer.jsx";
import HomeVinyl from "../components/HomeVinyl.jsx";

// Local, card-scoped tilt — each card computes its own tilt from the
// cursor position relative to itself (not a shared page-wide pointer),
// since these are three independent panels, not one depth scene.
// No-ops on touch and prefers-reduced-motion, same as the turntable's hook.
function useCardTilt() {
  const ref = useRef(null);

  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (reduceMotion || isTouch) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--tilt-x", `${(py * -6).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(px * 10).toFixed(2)}deg`);
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }

  return { ref, onMove, onLeave };
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
      <path d="M14.5 15c2.4.4 4 2.5 4 5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Home() {
  const solo = useCardTilt();
  const host = useCardTilt();
  const join = useCardTilt();

  return (
    <>
      {/* Scroll-driven vinyl — Home page only. Fixed layer, pointer-events
          none, sits behind everything below via .home-content-layer. */}
      <HomeVinyl />

      <div className="screen home-content-layer" style={{ padding: 0 }}>
        {/* ================= CINEMATIC HERO ================= */}
        <section className="studio-hero" id="play">
          <div className="studio-copy">
            <div className="hero-eyebrow">Music hits different here</div>
            <h1 className="studio-title">
              THREE WAYS
              <br />
              TO <span className="text-lime">DROP.</span>
            </h1>
            <p className="studio-subtitle">
              Same songs. Different vibes. Guess the track, feel the beat, and
              see who really knows music.
            </p>

            <div className="mode-cards">
              <Link
                to="/solo"
                className="mode-card accent-solo cursor-target"
                ref={solo.ref}
                onMouseMove={solo.onMove}
                onMouseLeave={solo.onLeave}
              >
                <span className="mode-icon">
                  <PersonIcon />
                </span>
                <span className="mode-body">
                  <h3>
                    Play <span>Solo</span>
                  </h3>
                  <p>Your Spotify, your pace — no room needed.</p>
                </span>
                <span className="mode-arrow">
                  <ArrowIcon />
                </span>
              </Link>

              <Link
                to="/host"
                className="mode-card accent-host cursor-target"
                ref={host.ref}
                onMouseMove={host.onMove}
                onMouseLeave={host.onLeave}
              >
                <span className="mode-icon">
                  <PeopleIcon />
                </span>
                <span className="mode-body">
                  <h3>
                    <span>Host</span>
                  </h3>
                  <p>Create a room and play with friends.</p>
                </span>
                <span className="mode-arrow">
                  <ArrowIcon />
                </span>
              </Link>

              <Link
                to="/join"
                className="mode-card accent-join cursor-target"
                ref={join.ref}
                onMouseMove={join.onMove}
                onMouseLeave={join.onLeave}
              >
                <span className="mode-icon">
                  <PeopleIcon />
                </span>
                <span className="mode-body">
                  <h3>
                    <span>Join</span>
                  </h3>
                  <p>Got a code from a host? Jump straight in.</p>
                </span>
                <span className="mode-arrow">
                  <ArrowIcon />
                </span>
              </Link>
            </div>
          </div>

          <div className="studio-scene parallax-stage">
            <div className="studio-wall" />
            <div className="studio-window">
              <div className="skyline">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} />
                ))}
              </div>
            </div>
            <div className="studio-lamp" />
            <div className="studio-poster" />
            <svg className="studio-plant" viewBox="0 0 60 90" aria-hidden="true">
              <path
                d="M30 90V45M30 45c-10 0-18-8-18-18M30 45c10 0 18-8 18-18M30 55c-8 0-14-6-14-14M30 55c8 0 14-6 14-14"
                stroke="rgba(120,160,110,0.5)"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <div className="studio-turntable-wrap">
              <Turntable size={340} parallax />
              <div className="lab-meta">
                <span>NEEDLE DROP</span>
                <span>PLAY · CONNECT · GUESS · REPEAT</span>
              </div>
            </div>
          </div>
        </section>

        {/* Real, non-numeric info bar — no invented stats. */}
        <div className="info-bar">
          <div className="info-bar-tags">
            <span className="info-tag">Spotify powered</span>
            <span className="info-tag">Play solo or with friends</span>
            <span className="info-tag">Real-time multiplayer</span>
          </div>
          <p className="info-quote">"Music connects people — we just make it a game."</p>
        </div>

        {/* ================= HOW IT WORKS ================= */}
        <section className="section" id="how-it-works">
          <div className="section-eyebrow">How it works</div>
          <h2 className="display-lg">Three steps. One drop.</h2>

          <div className="steps-row">
            <div className="step-cell">
              <div className="step-index">01</div>
              <h3 className="step-title">Pick a playlist</h3>
              <p className="step-desc">
                Connect Spotify and choose any playlist — or your Liked Songs —
                as the pool of tracks for the round.
              </p>
            </div>
            <div className="step-cell">
              <div className="step-index">02</div>
              <h3 className="step-title">Listen</h3>
              <p className="step-desc">
                The needle drops for as little as one second. No intro, no
                warning — just the track, cold.
              </p>
            </div>
            <div className="step-cell">
              <div className="step-index">03</div>
              <h3 className="step-title">Guess</h3>
              <p className="step-desc">
                Type the title before the clock runs out. Faster, harder
                snippets score more.
              </p>
            </div>
          </div>
        </section>

        {/* ================= GAME PREVIEW ================= */}
        <section className="section">
          <div className="section-eyebrow">Inside the game</div>
          <h2 className="display-lg">
            A live look at the <span className="text-lime">guessing screen.</span>
          </h2>

          <div className="preview-frame">
            <Turntable spinning size={120} />
            <Visualizer state="listening" />
            <div className="badge correct">+840 pts · 🔥 3 streak</div>

            <div style={{ width: "100%", maxWidth: 380 }}>
              <input
                type="text"
                value="Midnight C"
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                style={{ marginBottom: 4 }}
              />
              <div className="suggestion-panel">
                <div className="track-row is-active">
                  <div className="meta">
                    <div className="name">Midnight City</div>
                    <div className="artist">M83</div>
                  </div>
                </div>
                <div className="track-row">
                  <div className="meta">
                    <div className="name">Midnight Sun</div>
                    <div className="artist">Beach House</div>
                  </div>
                </div>
              </div>
            </div>

            <p className="hint" style={{ textAlign: "center" }}>
              Actual gameplay from Needle Drop — type a title, pick it from
              the live suggestions, submit before the timer runs out.
            </p>
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section className="section">
          <div className="section-eyebrow">What's included</div>
          <h2 className="display-lg">Built for one player or a full room.</h2>

          <div className="features-grid">
            <div className="feature-cell">
              <h4>Spotify playlists</h4>
              <p>Any playlist or your Liked Songs becomes the track pool — nothing pre-selected.</p>
            </div>
            <div className="feature-cell">
              <h4>Solo mode</h4>
              <p>Play by yourself, at your own pace, with your own library.</p>
            </div>
            <div className="feature-cell">
              <h4>Host & multiplayer rooms</h4>
              <p>One host plays the music out loud; everyone else guesses live from their phone.</p>
            </div>
            <div className="feature-cell">
              <h4>Scoring & streaks</h4>
              <p>Faster, harder snippets are worth more. Live leaderboard and streak tracking every round.</p>
            </div>
          </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="final-cta">
          <div className="section-eyebrow" style={{ justifyContent: "center" }}>
            Ready when you are
          </div>
          <h2 className="display-xl">
            READY FOR THE <span className="text-lime">NEXT DROP?</span>
          </h2>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <a href="#play" className="btn btn-primary cursor-target">
              Play Needle Drop
            </a>
          </div>
        </section>
      </div>
    </>
  );
}