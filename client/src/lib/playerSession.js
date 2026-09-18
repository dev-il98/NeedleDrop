const KEY = "needledrop_player_session";

/**
 * Saved right after a successful room join, and read back by PlayerGame if
 * React Router's location.state is missing — which happens after a full
 * page navigation away to Spotify's login and back. sessionStorage is
 * tab-scoped, so this never collides with a host session in another tab.
 */
export function savePlayerSession({ name, roomCode, playerId, trackChoices }) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ name, roomCode, playerId, trackChoices })
    );
  } catch {
    // sessionStorage can be unavailable (private browsing edge cases) —
    // location.state still covers the normal navigation path either way.
  }
}

export function loadPlayerSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
