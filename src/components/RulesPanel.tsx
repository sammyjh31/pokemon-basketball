const POSITION_GUIDE = [
  [
    "PG · Lead creator",
    "Passing, ball handling and speed. A slow or insecure handler limits even a talented passer.",
  ],
  [
    "SG · Shot maker",
    "Three-point and midrange shooting, handling and perimeter defense. Shooting alone cannot cover a weak handle.",
  ],
  [
    "SF · Two-way wing",
    "Finishing, outside shooting and perimeter coverage, with useful rebounding and creation.",
  ],
  [
    "PF · Physical forward",
    "Finishing, rebounding and interior defense. Strength and rebounding are essential.",
  ],
  [
    "C · Paint anchor",
    "Interior defense, both rebounding skills and finishing. Weak paint defense limits the role.",
  ],
  [
    "BENCH · Three reserves",
    "Reserves are rated at their best position. Add shooting, another creator and defensive coverage to support the starters.",
  ],
];
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
            <h3>Build an eight-player rotation</h3>
            <p>
              <b>Spin & Pick:</b> choose one of four Pokémon for each slot. Fill
              five starters and three reserves using two re-rolls for the entire
              draft.
            </p>
            <p>
              <b>Free Draft:</b> search the original 151, pick or replace any
              player, swap occupied slots, and use auto-fill for an open bench.
            </p>
            <p>
              Each Pokémon can appear once. All eight slots must be filled
              before you simulate. Changing modes or the legendary pool starts a
              new run.
            </p>
          </div>
          <div>
            <h3>Play 82 games</h3>
            <p>
              Face 29 Kanto League opponents across 41 home and 41 away games.
              Your roster, tactic and rotation lock when you simulate.
            </p>
            <p>
              Games are built from seeded basketball events: shots, free throws,
              turnovers, rebounds, assists, steals and blocks. Scores come from
              those possessions, and a tie triggers overtime.
            </p>
            <p>
              Open a completed game for all eight players’ box scores. Your run
              and records save in this browser. The same roster, coaching and
              season seed reproduce the same results.
            </p>
          </div>
        </div>
        <h3>How Pokémon become basketball players</h3>
        <p>
          These are fictional basketball ratings, inspired by each Pokémon’s six
          base stats, height, weight and types. Every basketball skill is on a
          0–100 scale. Legendary status adds no hidden bonus.
        </p>
        <div className="formula-grid">
          <div>
            <strong>Base stats have diminishing returns</strong>
            <span>
              Each stat uses 100 × (1 − exp(−stat / 100)) / (1 − exp(−2)),
              capped at a base stat of 200. Attack feeds finishing and strength;
              special attack and special defense feed shooting, passing and
              composure.
            </span>
          </div>
          <div>
            <strong>Size comes with a cost</strong>
            <span>
              Height and weight use logarithmic curves, capped at 3.5 m and 350
              kg. Reach improves blocks and boards; mass improves strength.
              Heavy bodies lose some court speed, leap and stamina.
            </span>
          </div>
          <div>
            <strong>Types are small tendencies</strong>
            <span>
              Types nudge individual skills by at most four points, averaged for
              dual types. Electric players gain speed; Psychic players gain
              passing; Rock players gain strength and lose some speed. There is
              no battle type matchup chart.
            </span>
          </div>
          <div>
            <strong>20 skills tell the story</strong>
            <span>
              Six broad skills summarize 14 specialist tools, including shot
              ranges, handles, passing, athleticism, defensive events and
              composure. Open a player’s full scouting report to see the source
              stats and every rating.
            </span>
          </div>
          <div>
            <strong>Weak links matter</strong>
            <span>
              Position fit blends a role’s weighted skill average (80%) with its
              weakest essential skill (20%). A high total stat line does not
              guarantee a fit at every position.
            </span>
          </div>
          <div>
            <strong>Build a connected lineup</strong>
            <span>
              Team offense and defense account for playing time, role fit and
              fatigue. Outside shooting creates spacing, creators support the
              offense, and perimeter coverage plus rim protection support the
              defense.
            </span>
          </div>
        </div>
        <h3>Find the right role</h3>
        <div className="formula-grid">
          {POSITION_GUIDE.map(([title, description]) => (
            <div key={title}>
              <strong>{title}</strong>
              <span>{description}</span>
            </div>
          ))}
        </div>
        <div className="rule-columns">
          <div>
            <h3>Choose your coaching</h3>
            <p>
              <b>Balanced</b> keeps a broad approach. <b>Run & gun</b> favors
              speed and stamina. <b>Space & shoot</b> rewards perimeter skills.{" "}
              <b>Inside out</b> favors finishing and offensive boards.{" "}
              <b>Defense first</b> trades some offensive rating for defense.
            </p>
            <p>
              A tactic’s value depends on the roster. Fast play adds fatigue
              pressure; a slow, heavy team cannot simply outrun everyone.
            </p>
          </div>
          <div>
            <h3>Minutes and depth</h3>
            <p>
              <b>Balanced</b> aims for roughly 170 starter minutes.{" "}
              <b>Lean on starters</b> shifts toward 185; <b>Use the bench</b>{" "}
              shifts toward 150. Role quality and stamina adjust each share.
            </p>
            <p>
              Every regulation box score totals 240 player-minutes, with no
              individual above 40 before overtime. Each extra period adds 25.
              Heavy minutes above a player’s stamina allowance reduce
              effectiveness, so reserves matter.
            </p>
          </div>
        </div>
        <h3>Follow production, earn team honors</h3>
        <p>
          When the season reveal finishes, compare per-game numbers, totals,
          shooting percentages, true shooting and game highs. The season totals
          are the sum of actual game box scores.
        </p>
        <p>
          Six <b>team awards</b> recognize your roster’s MVP, Defensive Player,
          Sixth Player, Scoring Leader, Playmaker and Rebounding Leader. They
          are based on simulated production, with stable tie-breaks. These are
          awards within your team, not league-wide or career honors.
        </p>
        <p>
          MVP and Sixth Player combine points, rebounds, assists, steals and
          blocks, subtracting turnovers and missed shots. Defensive Player
          rewards blocks, steals and defensive rebounds. The three leader awards
          use total points, assists and rebounds; exact ties go to the lower
          Pokédex number.
        </p>
        <p>
          Older five-player saves keep their starting five and records. A
          previously completed season remains an archived recap; start a new
          eight-player season to generate player statistics and box scores.
        </p>
      </div>
    </details>
  );
}
