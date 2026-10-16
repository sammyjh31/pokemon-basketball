import { useMemo, useState } from "react";
import type { ShotEvent } from "../game/engineInsightsTypes";
import type { MatchupEvidence } from "../game/bodyMatchups";
import { insightPlayerName } from "./insightFormat";
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
type Row = {
  evidence: MatchupEvidence;
  teamId: number;
  events: number;
  won: number;
  seals: number;
  points: number;
  physical: number;
  type: number;
  advantage: number;
  resistance: number;
};
export function BodyMatchupInsights({
  shots,
  teams,
}: {
  shots: ShotEvent[];
  teams: { id: number; name: string }[];
}) {
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    const groups = new Map<string, Row>();
    for (const shot of shots) {
      const e = shot.matchup;
      if (!e) continue;
      const key = `${e.attackerId}/${e.defenderId}`;
      const row = groups.get(key) ?? {
        evidence: e,
        teamId: shot.offenseTeamId,
        events: 0,
        won: 0,
        seals: 0,
        points: 0,
        physical: 0,
        type: 0,
        advantage: 0,
        resistance: 0,
      };
      row.events++;
      row.won += Number(e.won);
      row.seals += Number(e.action === "post seal");
      row.points += shot.made ? shot.value : 0;
      row.physical += e.physicalChanceDelta;
      row.type += e.typeChanceDelta;
      row.advantage += Number(e.typeEdge > 0);
      row.resistance += Number(e.typeEdge < 0);
      groups.set(key, row);
    }
    return [...groups.values()].sort((a, b) => b.events - a.events);
  }, [shots]);
  return (
    <section
      className="insight-section"
      aria-label="Physical and type matchup impact"
    >
      <h4>Matchups that shaped the attacks</h4>
      {!rows.length ? (
        <p>Physical matchup contests were not recorded for this game.</p>
      ) : (
        <>
          <p>
            Each attack tests whether the shooter can establish a post seal or
            create separation. Body leverage, reach, movement, typing, screens
            and help defense affect that contest. A won advantage still needs a
            made shot.
          </p>
          <div className="analysis-cards">
            {teams.map((team) => {
              const own = rows.filter((r) => r.teamId === team.id),
                total = own.reduce((n, r) => n + r.events, 0);
              if (!total) return null;
              return (
                <article key={team.id}>
                  <span className="eyebrow">{team.name}</span>
                  <strong>
                    {own.reduce((n, r) => n + r.won, 0)} / {total} advantages
                    won
                  </strong>
                  <p>
                    {own.reduce((n, r) => n + r.seals, 0)} deep post seals ·{" "}
                    {own.reduce((n, r) => n + r.advantage, 0)} attacks with type
                    advantage · {own.reduce((n, r) => n + r.resistance, 0)}{" "}
                    resisted.
                  </p>
                  <small>
                    Average shot-chance shift: body / action{" "}
                    {signed(
                      (100 * own.reduce((n, r) => n + r.physical, 0)) / total,
                    )}{" "}
                    pp; type{" "}
                    {signed(
                      (100 * own.reduce((n, r) => n + r.type, 0)) / total,
                    )}{" "}
                    pp.
                  </small>
                </article>
              );
            })}
          </div>
          <div
            className="results-table-wrap"
            role="region"
            tabIndex={0}
            aria-label="Scrollable physical and type matchups"
          >
            <table className="results-table">
              <caption className="sr-only">Physical and type matchups</caption>
              <thead>
                <tr>
                  {[
                    "ATTACKER → DEFENDER",
                    "CATALOG SIZE",
                    "SHOT EVENTS",
                    "ADVANTAGES WON",
                    "POST SEALS",
                    "FG POINTS",
                    "BODY / ACTION",
                    "TYPE",
                  ].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(all ? rows : rows.slice(0, 8)).map((r) => (
                  <tr key={`${r.evidence.attackerId}/${r.evidence.defenderId}`}>
                    <th scope="row">
                      {insightPlayerName(r.evidence.attackerId)} →{" "}
                      {insightPlayerName(r.evidence.defenderId)}
                    </th>
                    <td>
                      {r.evidence.attackerHeight} m /{" "}
                      {r.evidence.attackerWeight} kg
                      <small>
                        vs {r.evidence.defenderHeight} m /{" "}
                        {r.evidence.defenderWeight} kg
                      </small>
                    </td>
                    <td>{r.events}</td>
                    <td>{r.won}</td>
                    <td>{r.seals}</td>
                    <td>{r.points}</td>
                    <td>{signed((r.physical / r.events) * 100)} pp</td>
                    <td>{signed((r.type / r.events) * 100)} pp</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 8 && (
            <button
              type="button"
              className="insight-button"
              onClick={() => setAll(!all)}
            >
              {all
                ? "Show eight most-used matchups"
                : `Show all ${rows.length} matchups`}
            </button>
          )}
          <p className="insight-note">
            Shifts describe conditional shot chance before blocks and shooting
            fouls. Body / action includes physical advantages, screens,
            containment and help; type is applied afterward. Samples are shot
            events, including shooting-foul misses. These are model effects for
            the observed attacks, not a counterfactual winning margin. Catalog
            height is compressed into reach, not treated as measured standing
            reach.
          </p>
        </>
      )}
    </section>
  );
}
