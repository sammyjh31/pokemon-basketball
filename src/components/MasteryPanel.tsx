import { POKEMON_BY_ID } from "../data/pokemon";
import { masteryFactor, masteryLevel } from "../game/masteryMath";
import { abilitiesEnabled, speciesAbility } from "../game/abilities";
import {
  masteryXp,
  type MasteryGameReport,
  type MasteryPlayerReport,
  type MasteryTrainingChange,
} from "../game/abilityMastery";
import { ROSTER_SLOTS, type LeagueTeam } from "../game/types";
import { TRAINING_FOCUS_LABELS } from "../game/training";
import "../leagueNews.css";
const name = (id: number) => POKEMON_BY_ID.get(id)?.name ?? `Pokémon #${id}`;
export function MasteryPanel({
  team,
  historical = false,
  pokemonId,
}: {
  team: LeagueTeam;
  historical?: boolean;
  pokemonId?: number;
}) {
  if (team.abilityMasteryVersion !== 1)
    return (
      <section className="mastery-panel" aria-label="Ability mastery">
        <h3>Ability mastery</h3>
        <p>
          Ability mastery was not recorded under this season’s rules. No past XP
          is inferred.
        </p>
      </section>
    );
  const enabled = abilitiesEnabled(team);
  return (
    <section className="mastery-panel" aria-label="Ability mastery">
      <div className="mastery-heading">
        <h3>Ability mastery</h3>
        <span>
          {historical
            ? "Archived roster snapshot"
            : "Persistent player progress"}
        </span>
      </div>
      <p>
        Official games and offseason training earn XP. Mastery strengthens
        existing ability bonuses by up to 20%; it does not add base rating
        points. Earned XP follows players through trades and seasons. Practice
        games award no XP.
      </p>
      {(team.courtVersion ?? 0) >= 4 && (
        <p>
          Regular rotation minutes build toward Practiced during a season;
          frequent ability use can reach Skilled. Playing time, ability use and
          your coach shape each player’s progress.
        </p>
      )}
      {!enabled && (
        <p className="notice">
          Abilities are disabled. Saved mastery is retained, with no ability
          boost or game XP.
        </p>
      )}
      <ul className="mastery-roster">
        {ROSTER_SLOTS.flatMap((slot) => {
          const id = team.roster[slot];
          if (id == null || (pokemonId !== undefined && id !== pokemonId))
            return [];
          const value = masteryXp(team, id),
            level = masteryLevel(value),
            next = masteryLevel(level.next ?? 1000);
          const mon = POKEMON_BY_ID.get(id),
            ability = mon && speciesAbility(mon.id);
          return [
            <li key={id}>
              <div className="mastery-heading">
                <strong>{name(id)}</strong>
                <span className="mastery-tier">{level.name}</span>
              </div>
              <small>{ability?.name ?? "Species ability"}</small>
              <div className="mastery-heading">
                <b>{value.toFixed(2)} XP</b>
                <small>
                  {enabled
                    ? `${((masteryFactor(value) - 1) * 100).toFixed(1)}% stronger ability bonuses`
                    : "Ability effects off"}
                </small>
              </div>
              <progress
                value={level.next === null ? 1 : value - level.start}
                max={level.next === null ? 1 : level.next - level.start}
                aria-label={`${name(id)} ability mastery`}
                aria-valuetext={
                  level.next === null
                    ? `Master tier reached · ${value.toFixed(2)} total XP`
                    : `${(value - level.start).toFixed(2)} of ${level.next - level.start} XP toward ${next.name}`
                }
              />
              <small>
                {level.next === null
                  ? "Master tier reached · 1,000 XP maximum"
                  : `${Math.max(0, level.next - value).toFixed(2)} XP to ${next.name}`}
              </small>
            </li>,
          ];
        })}
      </ul>
    </section>
  );
}
function ChangeRows({ rows }: { rows: MasteryPlayerReport[] }) {
  return (
    <ul className="mastery-changes">
      {rows.map((row) => (
        <li key={row.pokemonId}>
          <strong>{name(row.pokemonId)}</strong>
          <span>
            {row.before.toFixed(2)} → {row.after.toFixed(2)} XP (+
            {row.gained.toFixed(2)})
          </span>
          <small>
            {row.levelBefore} → {row.levelAfter}
          </small>
        </li>
      ))}
    </ul>
  );
}
export function GameMasteryReport({
  report,
  home,
  away,
}: {
  report?: MasteryGameReport;
  home: Pick<LeagueTeam, "name">;
  away: Pick<LeagueTeam, "name">;
}) {
  if (!report) return null;
  return (
    <section className="mastery-panel" aria-label="Game ability mastery">
      <h3>Ability mastery · this game</h3>
      <p>
        Saved pregame and postgame XP. Later games and training do not change
        this report.
      </p>
      <div className="mastery-game-sides">
        <div>
          <h4>{home.name}</h4>
          <ChangeRows rows={report.home} />
        </div>
        <div>
          <h4>{away.name}</h4>
          <ChangeRows rows={report.away} />
        </div>
      </div>
    </section>
  );
}
export function MasteryTrainingReport({
  changes,
  teams,
  year,
}: {
  changes?: MasteryTrainingChange[];
  teams: Pick<LeagueTeam, "id" | "name">[];
  year: number;
}) {
  if (!changes?.length) return null;
  return (
    <section
      className="mastery-panel"
      aria-label={`Year ${year} mastery training`}
    >
      <h3>Ability mastery · completed camp</h3>
      <p>
        Year {year} · Recorded training gains, already applied once. These plans
        and reasons belong to that camp.
      </p>
      <ul className="mastery-roster">
        {changes.map((row) => (
          <li key={`${row.teamId}:${row.pokemonId}`}>
            <div className="mastery-heading">
              <strong>{name(row.pokemonId)}</strong>
              <span className="mastery-tier">{row.levelAfter}</span>
            </div>
            <small>
              {teams.find((t) => t.id === row.teamId)?.name ??
                `Team ${row.teamId}`}
            </small>
            <p>
              {row.before.toFixed(2)} → {row.after.toFixed(2)} XP (+
              {row.gained.toFixed(2)})
            </p>
            <p>
              Completed focus: {TRAINING_FOCUS_LABELS[row.focus]}
              {row.breakthrough ? " · Training breakthrough" : ""}
            </p>
            <details>
              <summary>Recorded training reasons</summary>
              <ul>
                {row.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
