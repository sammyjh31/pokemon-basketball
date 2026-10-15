import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_WEIGHTS,
  POSITION_WEIGHTS,
} from "../game/ratings";
import { SEASON_RULES } from "../game/season";
import { POSITIONS } from "../game/types";
const sourceLabels: Record<string, string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Attack",
  specialDefense: "Sp. Defense",
  speed: "Speed",
  height: "Height",
  weight: "Weight",
};
export function RulesPanel() {
  return (
    <details className="rules-panel" id="rules">
      <summary>
        <span>
          <span className="eyebrow">THE PLAYBOOK</span>
          <strong>Basketball brains. Pokémon stats.</strong>
        </span>
        <span className="rules-plus" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="rules-content">
        <div className="rule-columns">
          <div>
            <h3>Draft your five</h3>
            <p>
              <b>Spin & Pick:</b> choose one of four Pokémon and lock it into a
              position. You get two re-rolls for the whole draft.
            </p>
            <p>
              <b>Free Draft:</b> search any of the original 151. Replace a
              player by picking a new Pokémon and its position, or tap two court
              positions to swap them.
            </p>
            <p>
              Each Pokémon can appear once. Changing modes or the legendary pool
              starts a new run.
            </p>
          </div>
          <div>
            <h3>Chase 82–0</h3>
            <p>
              Play 82 games against 29 Kanto League opponents, with 41 at home
              and 41 away. One season per lineup; finishing locks your roster.
            </p>
            <p>
              Better offense, defense, and position fit improve your odds. Every
              game has a little uncertainty. Your MVP earns the most
              player-of-the-game awards.
            </p>
            <p>
              Your draft and records save in this browser. Types are
              identifiers, not battle effectiveness bonuses.
            </p>
          </div>
        </div>
        <h3>Where the numbers come from</h3>
        <p>
          Base stats are scaled as stat ÷ 160 × 100. Height uses 100 × ln(1 +
          meters) ÷ ln(4), and weight uses 100 × ln(1 + kilograms) ÷ ln(251).
          Each input is capped at 100 so extreme size stays balanced.
        </p>
        <div className="formula-grid">
          {ATTRIBUTE_KEYS.map((key) => (
            <div key={key}>
              <strong>{ATTRIBUTE_LABELS[key]}</strong>
              <span>
                {Object.entries(ATTRIBUTE_WEIGHTS[key])
                  .map(
                    ([stat, w]) =>
                      `${Math.round(w * 100)}% ${sourceLabels[stat]}`,
                  )
                  .join(" + ")}
              </span>
            </div>
          ))}
        </div>
        <h3>Position fit</h3>
        <div className="formula-grid">
          {POSITIONS.map((p) => (
            <div key={p}>
              <strong>{p}</strong>
              <span>
                {ATTRIBUTE_KEYS.filter((_k, i) => POSITION_WEIGHTS[p][i] > 0)
                  .map(
                    (k) =>
                      `${Math.round(POSITION_WEIGHTS[p][ATTRIBUTE_KEYS.indexOf(k)] * 100)}% ${ATTRIBUTE_LABELS[k]}`,
                  )
                  .join(" + ")}
              </span>
            </div>
          ))}
        </div>
        <p>
          Player offense is 35% shooting + 30% playmaking + 35% finishing;
          defense is 40% perimeter defense + 35% interior defense + 25%
          rebounding. Each is blended with position fit at 75% attributes + 25%
          fit, then averaged across the team. Overall is the mean of offense and
          defense.
        </p>
        <p>
          Game odds use a logistic curve: 1 ÷ (1 + exp(−difference ÷{" "}
          {SEASON_RULES.probabilityScale})). Difference is the average of your
          offense versus their defense and your defense versus their offense,
          plus {SEASON_RULES.homeAdvantage} at home or minus it away. Odds are
          capped at {SEASON_RULES.minProbability * 100}%–
          {SEASON_RULES.maxProbability * 100}%. Scores are generated to match
          the sampled winner, with overtime resolving ties. Player-of-the-game
          chances are weighted by position rating squared.
        </p>
      </div>
    </details>
  );
}
