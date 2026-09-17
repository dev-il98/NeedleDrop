import "./game-ui.css";

/**
 * player: { name, score, connected } — exactly what the server already sends.
 * rank: optional 1-based rank number to display.
 * flash: bool — briefly highlight on a correct guess.
 */
export default function PlayerTile({ player, rank, flash }) {
  return (
    <div className={`player-tile${flash ? " correct-flash" : ""}`}>
      <div className="player-tile-left">
        {rank != null && <span className="player-tile-rank">#{rank}</span>}
        <span className="player-tile-name">{player.name}</span>
        {player.connected === false && (
          <span className="player-tile-offline">offline</span>
        )}
      </div>
      <span className="player-tile-score">{player.score}</span>
    </div>
  );
}
