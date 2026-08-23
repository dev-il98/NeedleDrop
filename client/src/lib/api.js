export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://127.0.0.1:4000";

async function request(path, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
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
