import { CounterLearningResults } from "./CounterLearningReport";
import { POKEMON_BY_ID } from "../data/pokemon";
import { getCoach } from "../game/trainerCoaches";
import type { SeedOpponent } from "../game/scoutingContinuityTypes";
import type { LeagueTeam } from "../game/types";

export function ScoutingContinuityNote({
  entry,
  coachId,
}: {
  entry: SeedOpponent;
  coachId?: string;
}) {
  return (
    <p className="coach-footnote">
      {entry.sourceCoachId === coachId ? "Personal scouting" : "Club handover"}{" "}
      from {getCoach(entry.sourceCoachId)?.name ?? "the previous staff"}, season{" "}
      {entry.sourceYear}. {entry.retainedPlayers}/8 players remain from the
      scouted roster.
      {entry.coachChanged &&
        " New opposing coach: old system and combo reads carry less weight."}{" "}
      Older evidence fades; known player tendencies follow Pokémon after trades.
      New meetings refresh these reads automatically.
    </p>
  );
}
export function CoachScoutingSummary({ team }: { team: LeagueTeam }) {
  const seed = team.scoutingSeed;
  if (!seed || seed.coachId !== team.coach?.id) return null;
  const entries = Object.values(seed.opponents);
  return (
    <section
      className="mastery-panel"
      aria-label="Scouting carried into this season"
    >
      <h3>Scouting carried into this season</h3>
      <p>
        {entries.length} opponent{entries.length === 1 ? "" : "s"} in your
        coach’s opening knowledge book. Coaches use retained scouting
        automatically when planning counters and matchups.
      </p>
      <details>
        <summary>View opponent knowledge and offseason changes</summary>
        {entries.map((entry) => (
          <article key={entry.opponentName}>
            <h4>{entry.opponentName}</h4>
            <ScoutingContinuityNote entry={entry} coachId={seed.coachId} />
            <p>
              Recognized player tendencies:{" "}
              {Object.keys(entry.scouting.players)
                .map((id) => POKEMON_BY_ID.get(Number(id))?.name ?? id)
                .join(", ") || "No recorded shots yet"}
              .
            </p>
            {entry.scouting.counterResults && (
              <CounterLearningResults
                label={`${entry.opponentName} counter results carried forward`}
                results={entry.scouting.counterResults}
              />
            )}
          </article>
        ))}
        <p>
          Team and pair patterns lose confidence after roster changes. A new
          hire receives weaker club reports alongside their own scouting. This
          is opening knowledge; game reports include learning from the current
          season.
        </p>
      </details>
    </section>
  );
}
