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

/**
 * Creates and connects a Spotify.Player instance for this browser tab.
 * Used by the host's device (local mode) AND, for remote mode, by each
 * player's own device — deviceName lets each show up distinctly in Spotify.
 * Requires the connected account to have Spotify Premium.
 */
export async function createHostPlayer({
  onReady,
  onStateChanged,
  onError,
  onAutoplayFailed,
  deviceName = "Needle Drop (Guess the Song)",
}) {
  const Spotify = await loadSdkScript();

  const player = new Spotify.Player({
    name: deviceName,
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
  player.addListener("playback_error", ({ message }) => onError?.(message));
  // Not all SDK versions emit this, but wire it up when they do — browsers
  // increasingly block audio until the user has interacted with the page.
  player.addListener("autoplay_failed", () =>
    onAutoplayFailed?.("Tap Activate Spotify to enable playback in this browser.")
  );
  if (onStateChanged) player.addListener("player_state_changed", onStateChanged);

  await player.connect();
  return player;
}
