import { POKEMON_BY_ID } from "../../data/pokemon";
import { positionRatingFromAttributes } from "../ratings";
import { typeLineupBonuses } from "../typeCoaching";
import { typeMatchup } from "../typeMatchups";
import { activePlayers } from "./helpers";
import type { ArcadePlayer, ArcadeState } from "./types";

const types = (p: ArcadePlayer) =>
  POKEMON_BY_ID.get(p.pokemonId)?.types ?? [p.type];
const edge = (a: ArcadePlayer, b: ArcadePlayer) =>
  typeMatchup(types(a), types(b)).edge;

/** Choose one CPU swap at a dead ball. A short cooldown and a meaningful gain
 * prevent cycling through counters on every inbound; severe fatigue can override it. */
export function chooseCpuSubstitution(
  s: ArcadeState,
): { outId: number; inId: number } | undefined {
  const active = activePlayers(s, 1),
    opponents = activePlayers(s, 0);
  const bench = s.players.filter((p) => p.team === 1 && !p.active);
  let last: ArcadeState["events"][number] | undefined;
  for (let i = s.events.length - 1; i >= 0; i--)
    if (s.events[i].kind === "sub" && s.events[i].team === 1) {
      last = s.events[i];
      break;
    }
  const coolingDown = last !== undefined && s.elapsed - last.time < 8;
  const bonuses = new Map(
    [...active, ...bench].map((p) => [
      p,
      typeLineupBonuses(p, opponents, edge),
    ]),
  );
  let best: { outId: number; inId: number } | undefined,
    bestGain = 2.5;
  active.forEach((out, role) => {
    for (const incoming of bench) {
      const emergencyRest =
        out.energy < 40 && incoming.energy > out.energy + 15;
      if (coolingDown && !emergencyRest) continue;
      const score = (p: ArcadePlayer) =>
        positionRatingFromAttributes(p.attributes, out.slot) * 0.75 +
        p.energy * 0.35 +
        (bonuses.get(p)?.[role] ?? 0);
      const gain = score(incoming) - score(out);
      if (gain > bestGain) {
        bestGain = gain;
        best = { outId: out.id, inId: incoming.id };
      }
    }
  });
  return best;
}
