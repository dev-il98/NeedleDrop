# Needle Drop — guess the song from Spotify

A multiplayer "name that tune" game. One person hosts (connects their
Spotify), picks a playlist, and creates a room. Friends join from their own
phones with a 4-letter code and race to guess each song from a ~1-second
snippet.

## How it works

- **Host** connects Spotify (Premium required), picks a playlist, creates a
  room, and controls the game from their browser. The song snippet plays out
  loud from the host's device via the Spotify Web Playback SDK.
- **Players** just open a link, enter the room code + their name, and guess
  from their own phone — no Spotify account needed.
- Scoring rewards fast, correct guesses. First round of a track plays 1
  second; the reveal shows the full title, artist, and live leaderboard.

This first build is aimed at **"local" mode** — everyone physically together,
listening to one device. A **"remote" mode** option is in the UI as a
placeholder for a v2 where every player's own device plays the snippet in
sync (see "What's not built yet" below).

## Project structure

```
guess-the-song/
  server/   Node + Express + Socket.IO backend, Spotify OAuth & API calls
  client/   React (Vite) frontend — host controls + player screens
```

## 1. Create a Spotify app

1. Go to https://developer.spotify.com/dashboard and log in with the Spotify
   account you'll host with (needs **Premium**).
2. Click **Create app**. Any name/description is fine.
3. Add this Redirect URI exactly: `http://127.0.0.1:4000/auth/callback`
4. Save, then copy the **Client ID** and **Client Secret**.

## 2. Backend setup

```bash
cd server
cp .env.example .env
```

Edit `.env` and fill in:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

Then install and run:

```bash
npm install
npm run dev
```

You should see `Guess the Song server running on http://127.0.0.1:4000`.

## 3. Frontend setup

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open **http://127.0.0.1:5173**.

> Use `127.0.0.1` rather than `localhost` for both — Spotify's OAuth and the
> Web Playback SDK are picky about this matching your redirect URI exactly.

## 4. Play

1. On the home page, the **host** clicks "Host a game" → "Connect Spotify" →
   logs in and grants access.
2. Pick a playlist (or Liked Songs), choose how many rounds, and create the
   room. You'll get a 4-letter code.
3. Everyone else goes to the site, clicks "Join a game," and enters the code
   + their name.
4. Host clicks "Start game." Each round: the snippet plays automatically,
   players type their guess, and the answer + leaderboard reveal after the
   guess window (or once everyone's guessed correctly).

## Playing with friends over the network

If players aren't on the same machine, you'll need the client (and ideally
the server) reachable from their phones — e.g. run both on a laptop and use
its LAN IP instead of `127.0.0.1` in both `.env` files and the Spotify
redirect URI, or deploy the server (Render/Railway/Fly.io) and the client
(Vercel/Netlify) and point `VITE_SERVER_URL` / `CLIENT_URL` / the Spotify
redirect URI at the deployed URLs.

## What's not built yet (ideas for v2)

- **True remote audio sync** — right now the snippet only plays from the
  host's device (by design, for "everyone in one room" play). Making it play
  on every player's own device would need either audio relay (WebRTC) from
  the host, or each player's browser independently loading the Spotify SDK
  (Premium required per player) or falling back to 30-second preview URLs
  (unreliable — many tracks no longer have one).
- **Increasing snippet length** on wrong guesses (Heardle-style: 1s → 2s →
  4s...) — the data model already has a `snippetMs` per round, so this is a
  small change in `gameManager.js`'s `startNextRound`.
- **Reconnect handling** for players who refresh mid-game (currently they'd
  need to rejoin with the same name, but scores aren't restored).
- **Persistent rooms/scores** — everything is in-memory today; a server
  restart wipes active games.
