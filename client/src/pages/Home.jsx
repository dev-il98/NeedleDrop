import { Link } from "react-router-dom";
import Turntable from "../components/Turntable.jsx";

export default function Home() {
  return (
    <div className="screen">
      <div className="hero">
        <Turntable size={180} />
        <div className="brand">
          <span className="brand-mark">NEEDLE DROP</span>
        </div>
        <div className="brand-tag" style={{ marginBottom: 20 }}>
          Guess the song from the first second
        </div>
        <p className="subtitle">
          Pull tracks straight from Spotify and turn them into a party game.
          One person hosts and plays the music, everyone else guesses from
          their own phone.
        </p>

        <div className="stack">
          <Link to="/host" className="big-choice">
            <span className="choice-tag">HOST</span>
            <div>
              <h3>Host a game</h3>
              <p>Connect Spotify, pick a playlist, get a room code.</p>
            </div>
          </Link>
          <Link to="/join" className="big-choice">
            <span className="choice-tag">JOIN</span>
            <div>
              <h3>Join a game</h3>
              <p>Enter a room code from your host and start guessing.</p>
            </div>
          </Link>
          <Link to="/solo" className="big-choice">
            <span className="choice-tag">SOLO</span>
            <div>
              <h3>Play solo</h3>
              <p>Connect your own Spotify and play by yourself — no room needed.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}