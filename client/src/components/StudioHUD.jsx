import "./studio.css";

export default function StudioHUD({
  score = 0,
  round = 1,
  totalRounds = 10,
  streak = 0,
}) {
  return (
    <div className="studio-hud">
      <div className="studio-hud__item">
        <span>SCORE</span>
        <strong>{score}</strong>
      </div>

      <div className="studio-hud__item studio-hud__item--center">
        <span>ROUND</span>
        <strong>
          {round}/{totalRounds}
        </strong>
      </div>

      <div className="studio-hud__item">
        <span>STREAK</span>
        <strong>{streak}</strong>
      </div>
    </div>
  );
}