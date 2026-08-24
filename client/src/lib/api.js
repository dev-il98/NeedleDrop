export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://127.0.0.1:4000";

const SID_STORAGE_KEY = "needledrop_sid";

// Some mobile browsers block cross-site cookies even when the backend and
// frontend are on different domains (e.g. Railway + Vercel), which breaks
// cookie-based sessions. As a fallback, the backend also hands the session
// id back via a URL param after login; we stash it here and send it as a
// header on every request so auth keeps working even without cookies.
export function captureSidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("sid");
  if (sid) {
    localStorage.setItem(SID_STORAGE_KEY, sid);
    params.delete("sid");
    const cleanUrl =
      window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
    window.history.replaceState({}, "", cleanUrl);
  }
}

function getStoredSid() {
  return localStorage.getItem(SID_STORAGE_KEY);
}

async function request(path, options = {}) {
  const sid = getStoredSid();
  const res = await fetch(`${SERVER_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(sid ? { "X-Session-Id": sid } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  authStatus: () => request("/auth/status"),
  getToken: () => request("/auth/token"),
  getPlaylists: () => request("/api/playlists"),
  getPlaylistTracks: (id) => request(`/api/playlists/${id}/tracks`),
  getLikedSongsMeta: () => request("/api/liked-songs/meta"),
  getLikedSongsTracks: () => request("/api/liked-songs/tracks"),
  loginUrl: () => `${SERVER_URL}/auth/login`,
};