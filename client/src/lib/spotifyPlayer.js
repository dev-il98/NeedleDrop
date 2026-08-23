import { api } from "./api";

let sdkLoadPromise = null;

function loadSdkScript() {
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.Spotify) return resolve(window.Spotify);
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = reject;
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = () => resolve(window.Spotify);
  });
  return sdkLoadPromise;
}

// Creates and connects a Spotify.Player instance for the host's browser tab.
// Requires the host to have Spotify Premium.
export async function createHostPlayer({ onReady, onStateChanged, onError }) {
  const Spotify = await loadSdkScript();

  const player = new Spotify.Player({
    name: "Needle Drop (Guess the Song)",
    getOAuthToken: async (cb) => {
      try {
        const { accessToken } = await api.getToken();
        cb(accessToken);
      } catch (err) {
        onError?.(err.message || "Failed to refresh Spotify token.");
      }
    },
    volume: 0.8,
  });

  player.addListener("ready", ({ device_id }) => onReady?.(device_id));
  player.addListener("not_ready", () => onError?.("Playback device went offline."));
  player.addListener("initialization_error", ({ message }) => onError?.(message));
  player.addListener("authentication_error", ({ message }) => onError?.(message));
  player.addListener("account_error", () =>
    onError?.("Spotify Premium is required to play snippets from this app.")
  );
  if (onStateChanged) player.addListener("player_state_changed", onStateChanged);

  await player.connect();
  return player;
}
