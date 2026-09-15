import { Link, useLocation } from "react-router-dom";

// Only real routes/anchors — no invented "About" page. Hidden on /play:
// that screen is the active player-guessing surface, where the brief asks
// for "almost no cognitive overhead" — persistent chrome competes with the
// timer and input for attention right when speed matters most.
export default function NavBar() {
  const location = useLocation();
  if (location.pathname === "/play") return null;

  return (
    <nav className="nav-bar">
      <Link to="/" className="nav-logo cursor-target">
        NEEDLE DROP
      </Link>
      <div className="nav-links">
        <a href="/#play" className="nav-link cursor-target">
          Play
        </a>
        <a href="/#how-it-works" className="nav-link cursor-target">
          How it works
        </a>
      </div>
    </nav>
  );
}