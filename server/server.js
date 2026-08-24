import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";
import { nanoid } from "nanoid";

import {
  getLoginUrl,
  exchangeCodeForTokens,
  createSession,
  hasSession,
  getValidAccessToken,
  getMyPlaylists,
  getPlaylistTracks,
  getLikedSongs,
  getLikedSongsMeta,
} from "./spotify.js";
import { registerGameHandlers } from "./gameManager.js";

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || "http://127.0.0.1:5173";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Needed so secure cookies work correctly behind Railway's proxy.
app.set("trust proxy", 1);

// In production, frontend and backend live on different domains, so cookies
// need sameSite: "none" + secure: true to survive the cross-site OAuth
// redirect. Locally (http://127.0.0.1) that combination is blocked by
// browsers, so we fall back to "lax" + non-secure for dev.
const cookieOptions = {
  httpOnly: true,
  sameSite: IS_PRODUCTION ? "none" : "lax",
  secure: IS_PRODUCTION,
};

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// This data changes based on login state and must never be cached by the
// browser or any intermediate proxy — a cached 304 here is what was causing
// "connected: false" to stick around even after a successful login.
app.use("/auth", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});

const io = new SocketIOServer(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});

// ---------- Auth ----------

app.get("/auth/login", (req, res) => {
  const stateSessionId = nanoid(); // used only as OAuth "state" for CSRF protection
  res.cookie("oauth_state", stateSessionId, cookieOptions);
  res.redirect(getLoginUrl(stateSessionId));
});

app.get("/auth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${CLIENT_URL}/host?error=${encodeURIComponent(error)}`);
  if (!code || !state || state !== req.cookies.oauth_state) {
    return res.redirect(`${CLIENT_URL}/host?error=state_mismatch`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const sessionId = createSession(tokens);
    res.cookie("sid", sessionId, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    // Also hand the session id back via the URL as a fallback: some mobile
    // browsers block cross-site cookies even with sameSite:none, which would
    // silently break auth for a frontend/backend split across two domains.
    // The client stores this in localStorage and sends it as a header.
    res.redirect(`${CLIENT_URL}/host?connected=1&sid=${sessionId}`);
  } catch (err) {
    console.error("OAuth callback failed:", err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}/host?error=token_exchange_failed`);
  }
});

// Reads the session id from a cookie (same-origin/local dev) or an
// X-Session-Id header (cross-site production, where third-party cookies may
// be blocked by the browser).
function getSid(req) {
  return req.cookies.sid || req.headers["x-session-id"] || null;
}

app.get("/auth/status", (req, res) => {
  const sid = getSid(req);
  // TEMP DEBUG: confirms whether Railway is actually running this exact file.
  // Remove once confirmed.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("X-Debug-Version", "v2-test");
  res.json({ connected: !!sid && hasSession(sid) });
});

// Gives the host's browser a fresh access token for the Web Playback SDK.
app.get("/auth/token", async (req, res) => {
  const sid = getSid(req);
  if (!sid) return res.status(401).json({ error: "Not connected to Spotify." });
  const token = await getValidAccessToken(sid);
  if (!token) return res.status(401).json({ error: "Session expired, please reconnect." });
  res.json({ accessToken: token });
});

// ---------- Spotify data ----------

function requireSession(req, res, next) {
  const sid = getSid(req);
  if (!sid || !hasSession(sid)) {
    return res.status(401).json({ error: "Not connected to Spotify." });
  }
  req.sid = sid;
  next();
}

app.get("/api/playlists", requireSession, async (req, res) => {
  try {
    const playlists = await getMyPlaylists(req.sid);
    res.json({ playlists });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch playlists." });
  }
});

app.get("/api/liked-songs/meta", requireSession, async (req, res) => {
  try {
    const meta = await getLikedSongsMeta(req.sid);
    res.json(meta);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch liked songs." });
  }
});

app.get("/api/playlists/:id/tracks", requireSession, async (req, res) => {
  try {
    const tracks = await getPlaylistTracks(req.sid, req.params.id, 200);
    res.json({ tracks });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch tracks." });
  }
});

app.get("/api/liked-songs/tracks", requireSession, async (req, res) => {
  try {
    const tracks = await getLikedSongs(req.sid, 200);
    res.json({ tracks });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch liked songs." });
  }
});

// ---------- Socket.IO game logic ----------

io.on("connection", (socket) => {
  registerGameHandlers(io, socket);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Guess the Song server running on http://127.0.0.1:${PORT}`);
});