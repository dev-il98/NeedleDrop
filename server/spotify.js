import axios from "axios";
import { nanoid } from "nanoid";

const AUTH_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ");

// In-memory session store: sessionId -> { accessToken, refreshToken, expiresAt }
// Good enough for a single-host party game. Swap for Redis if you need
// multiple concurrent hosts across server restarts.
const sessions = new Map();

export function getLoginUrl(sessionId) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state: sessionId,
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
  });

  const res = await axios.post(`${AUTH_BASE}/api/token`, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
  });

  return res.data; // { access_token, refresh_token, expires_in, ... }
}

export function createSession(tokens) {
  const sessionId = nanoid();
  sessions.set(sessionId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000 - 60_000, // refresh 1 min early
  });
  return sessionId;
}

async function refreshSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  });

  const res = await axios.post(`${AUTH_BASE}/api/token`, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
  });

  session.accessToken = res.data.access_token;
  session.expiresAt = Date.now() + res.data.expires_in * 1000 - 60_000;
  // Spotify sometimes rotates the refresh token too
  if (res.data.refresh_token) session.refreshToken = res.data.refresh_token;
  sessions.set(sessionId, session);
  return session;
}

export async function getValidAccessToken(sessionId) {
  let session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() >= session.expiresAt) {
    session = await refreshSession(sessionId);
  }
  return session ? session.accessToken : null;
}

export function hasSession(sessionId) {
  return sessions.has(sessionId);
}

async function spotifyGet(sessionId, path, params = {}) {
  const token = await getValidAccessToken(sessionId);
  if (!token) throw new Error("NO_SESSION");
  const res = await axios.get(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function getMyPlaylists(sessionId) {
  const data = await spotifyGet(sessionId, "/me/playlists", { limit: 50 });
  return data.items.map((p) => ({
    id: p.id,
    name: p.name,
    image: p.images?.[0]?.url || null,
    trackCount: p.tracks?.total || 0,
    owner: p.owner?.display_name,
  }));
}

export async function getLikedSongsMeta(sessionId) {
  const data = await spotifyGet(sessionId, "/me/tracks", { limit: 1 });
  return { total: data.total };
}

function mapTrackItem(t) {
  if (!t) return null;
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    artists: (t.artists || []).map((a) => a.name).join(", "),
    album: t.album?.name || null,
    image: t.album?.images?.[0]?.url || null,
    durationMs: t.duration_ms,
    previewUrl: t.preview_url,
  };
}

// Fetches up to `limit` playable tracks from a playlist, paginating as needed.
export async function getPlaylistTracks(sessionId, playlistId, limit = 200) {
  const tracks = [];
  let offset = 0;
  const pageSize = 100;

  while (tracks.length < limit) {
    const data = await spotifyGet(
      sessionId,
      `/playlists/${playlistId}/tracks`,
      { limit: pageSize, offset, fields: "items(track(id,uri,name,artists,album,duration_ms,preview_url,is_playable)),next" }
    );
    const items = data.items || [];
    for (const item of items) {
      const t = item.track;
      if (t && t.id && t.uri && t.is_playable !== false) {
        tracks.push(mapTrackItem(t));
      }
    }
    if (!data.next || items.length === 0) break;
    offset += pageSize;
  }

  return tracks.slice(0, limit);
}

export async function getLikedSongs(sessionId, limit = 200) {
  const tracks = [];
  let offset = 0;
  const pageSize = 50;

  while (tracks.length < limit) {
    const data = await spotifyGet(sessionId, "/me/tracks", {
      limit: pageSize,
      offset,
    });
    const items = data.items || [];
    for (const item of items) {
      if (item.track) tracks.push(mapTrackItem(item.track));
    }
    if (items.length < pageSize) break;
    offset += pageSize;
  }

  return tracks.slice(0, limit);
}

export async function transferPlaybackToDevice(sessionId, deviceId) {
  const token = await getValidAccessToken(sessionId);
  await axios.put(
    `${API_BASE}/me/player`,
    { device_ids: [deviceId], play: false },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function playTrackOnDevice(sessionId, deviceId, trackUri, positionMs = 0) {
  const token = await getValidAccessToken(sessionId);
  await axios.put(
    `${API_BASE}/me/player/play?device_id=${deviceId}`,
    { uris: [trackUri], position_ms: positionMs },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function pausePlayback(sessionId, deviceId) {
  const token = await getValidAccessToken(sessionId);
  await axios.put(
    `${API_BASE}/me/player/pause?device_id=${deviceId}`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
}
