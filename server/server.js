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

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const io = new SocketIOServer(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});

// ---------- Auth ----------

app.get("/auth/login", (req, res) => {
  const stateSessionId = nanoid(); // used only as OAuth "state" for CSRF protection
  res.cookie("oauth_state", stateSessionId, { httpOnly: true, sameSite: "lax" });
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
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    res.redirect(`${CLIENT_URL}/host?connected=1`);
  } catch (err) {
    console.error("OAuth callback failed:", err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}/host?error=token_exchange_failed`);
  }
});

app.get("/auth/status", (req, res) => {
  const sid = req.cookies.sid;
  res.json({ connected: !!sid && hasSession(sid) });
});

// Gives the host's browser a fresh access token for the Web Playback SDK.
app.get("/auth/token", async (req, res) => {
  const sid = req.cookies.sid;
  if (!sid) return res.status(401).json({ error: "Not connected to Spotify." });
  const token = await getValidAccessToken(sid);
  if (!token) return res.status(401).json({ error: "Session expired, please reconnect." });
  res.json({ accessToken: token });
});

// ---------- Spotify data ----------

function requireSession(req, res, next) {
  const sid = req.cookies.sid;
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
