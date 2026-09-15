import { Link } from "react-router-dom";
import Turntable from "../components/Turntable.jsx";
import Visualizer from "../components/Visualizer.jsx";
import ModeSelection from "../components/ModeSelection.jsx";
import { useParallaxLayer } from "../lib/useParallax.js";

export default function Home() {
  const gridRef = useParallaxLayer("--px", "--py");

  return (
    <div className="screen" style={{ padding: 0 }}>
      {/* ================= 01 — HERO ================= */}
      <section className="hero parallax-stage">
        <div className="hero-bg-grid" ref={gridRef} />
        <div className="hero-inner">
          <div>
            <div className="hero-eyebrow">Needle Drop · Music Guessing Game</div>
            <h1 className="hero-title">
              CAN YOU RECOGNIZE A SONG
              <br />
              FROM JUST A <span className="text-lime">NEEDLE DROP?</span>
            </h1>
            <p className="hero-subtitle">
              Pull tracks straight from Spotify. Hear a fraction of a second.
              Guess before the record spins past you — solo, or against a
              room full of friends.
            </p>
            <div className="hero-actions">
              <a href="#play" className="btn btn-primary hero-cta cursor-target">
                Play Needle Drop
              </a>
              <a href="#how-it-works" className="btn btn-ghost cursor-target">
                How it works
              </a>
            </div>
          </div>

          <div className="turntable-stage hero-stage">
            <Turntable size={280} parallax />
            <div className="lab-meta">
              <span>33⅓ RPM</span>
              <span>SIDE A</span>
              <span>NEEDLE DROP</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CHOOSE YOUR MODE ================= */}
      <ModeSelection />

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
  );
}