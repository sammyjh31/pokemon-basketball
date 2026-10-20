import {
  CounterLearningDecision,
  CounterLearningResults,
} from "./CounterLearningReport";
import type { CounterResults } from "../game/counterLearning";
import {
  COUNTER_LABELS,
  COUNTER_IDS,
  type CounterPlan,
} from "../game/counterTypes";
import type { CourtSequence } from "../game/courtTypes";
import type { LeagueTeam } from "../game/types";
import { ScoutingContinuityNote } from "./CoachScoutingSummary";
import { POKEMON_BY_ID } from "../data/pokemon";
export function GameCounterReport({
  plans,
  results,
  teams,
  sequences = [],
}: {
  plans?: { home: CounterPlan[]; away: CounterPlan[] };
  results?: { home?: CounterResults; away?: CounterResults };
  teams: LeagueTeam[];
  sequences?: CourtSequence[];
}) {
  if (!plans) return null;
  const events = sequences.flatMap((s) => s.counters ?? []);
  return (
    <section className="mastery-panel" aria-label="Coach counter scouting">
      <h3>Coach counter scouting</h3>
      <p>
        Coaches automatically learn from observed moves and combo setups,
        including earlier meetings. Repeated patterns build confidence. Active
        defenders, mastery, chemistry, energy and cooldowns determine when they
        can respond.
      </p>
      {(["home", "away"] as const).map((side, i) => (
        <div key={side}>
          <h4>{teams[i]?.name ?? side} · pregame reads</h4>
          {teams[i]?.scoutingSeed?.opponents[teams[1 - i]?.id] && (
            <ScoutingContinuityNote
              entry={teams[i].scoutingSeed!.opponents[teams[1 - i].id]}
              coachId={teams[i].coach?.id}
            />
          )}
          {plans[side].length ? (
            <ul>
              {plans[side].map((plan) => (
                <li key={plan.id}>
                  {COUNTER_LABELS[plan.id]} · {plan.observations.toFixed(1)}{" "}
                  recent observations · {(plan.confidence * 100).toFixed(0)}%
                  confidence
                  {plan.learning && (
                    <CounterLearningDecision learning={plan.learning} />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              First meeting or not enough repeated evidence yet. The coach can
              still learn during this game.
            </p>
          )}
        </div>
      ))}
      <p>
        {events.filter((e) => COUNTER_IDS.includes(e.id as any)).length}{" "}
        defensive responses ·{" "}
        {events.filter((e) => !COUNTER_IDS.includes(e.id as any)).length}{" "}
        offensive counter-combos. These reduce or recover move bonuses; they are
        not guaranteed stops or made baskets. Each participant pays energy.
      </p>
      {results && (
        <details>
          <summary>Counter results in this game</summary>
          {(["home", "away"] as const).map(
            (side, i) =>
              results[side] && (
                <CounterLearningResults
                  key={side}
                  label={`${teams[i]?.name ?? side} counter outcomes`}
                  results={results[side]!}
                />
              ),
          )}
        </details>
      )}
      {events.length > 0 && (
        <details>
          <summary>View counter timing and participants</summary>
          <ul>
            {events.map((event, i) => (
              <li key={i}>
                {Math.floor(event.elapsedSeconds / 60)}:
                {String(Math.floor(event.elapsedSeconds % 60)).padStart(2, "0")}{" "}
                elapsed · {COUNTER_LABELS[event.id]} ·{" "}
                {event.playerIds
                  .map(
                    (id) =>
                      POKEMON_BY_ID.get(Number(id.split(":")[1]))?.name ?? id,
                  )
                  .join(" + ")}{" "}
                · {(event.confidence * 100).toFixed(0)}% read confidence ·{" "}
                {event.energySpent.reduce((a, b) => a + b, 0).toFixed(2)} energy
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
