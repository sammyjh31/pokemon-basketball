import type { EngineProfile } from "./engineDepth";
import type { PlayerProfile } from "./playerProfile";
import { typeLineupBonuses } from "./typeCoaching";
import { POSITIONS, type LeagueBox, type LeagueTeam } from "./types";
type Side = "home" | "away";
export interface Player {
  depth?: EngineProfile;
  types: readonly string[];
  typeEdges: Map<Player, number>;
  profile: PlayerProfile;
  box: LeagueBox;
  target: number;
  energy: number;
  consecutive: number;
}
export interface Team {
  config: LeagueTeam;
  players: Player[];
  floor: Player[]; // Ordered PG, SG, SF, PF, C, including substitute roles.
  side: Side;
  fouls: number;
  transition: number;
  counterSubstitutions?: number;
}
const ROLE_ORDER = [0, 4, 1, 3, 2];

function eligiblePlayers(team: Team): Player[] {
  const eligible = team.players.filter((p) => p.box.fouls < 6);
  if (team.config.rotationPlan) {
    const active = eligible.filter((p) => p.target > 0);
    // A zero-minute player is emergency cover only after foul-outs deplete the rotation.
    if (active.length < 5)
      active.push(
        ...eligible.filter((p) => p.target === 0).slice(0, 5 - active.length),
      );
    eligible.splice(0, eligible.length, ...active);
  }
  // Depleted-roster exception: basketball always remains five-on-five. Return
  // only the minimum disqualified players, preferring the fewest fouls. Every
  // subsequent personal foul by a returned player also incurs a technical FT.
  if (eligible.length < 5)
    eligible.push(
      ...team.players
        .filter((p) => p.box.fouls >= 6)
        .sort((a, b) => a.box.fouls - b.box.fouls || b.energy - a.energy)
        .slice(0, 5 - eligible.length),
    );
  return eligible;
}

const edge = (a: Player, b: Player) => a.typeEdges.get(b) ?? 0;
function scoutLineup(team: Team, opponents: readonly Player[]) {
  return new Map(
    team.config.typeMatchupsVersion === 1
      ? team.players.map(
          (p) => [p, typeLineupBonuses(p, opponents, edge)] as const,
        )
      : [],
  );
}

function recordCounters(
  team: Team,
  previous: Player[],
  bonuses: Map<Player, number[]>,
) {
  if (team.counterSubstitutions === undefined) return;
  team.floor.forEach((p, role) => {
    if (
      !previous.includes(p) &&
      !team.floor.includes(previous[role]) &&
      (bonuses.get(p)?.[role] ?? 0) >
        (bonuses.get(previous[role])?.[role] ?? 0) + 0.5
    )
      team.counterSubstitutions!++;
  });
}

export function chooseLineup(
  team: Team,
  minute: number,
  close: boolean,
  opponents: readonly Player[] = [],
): void {
  const pool = eligiblePlayers(team),
    chosen: Player[] = [];
  const bonuses = scoutLineup(team, opponents);
  const closers =
    close && team.config.rotationPlan
      ? pool.filter((p) =>
          team.config.rotationPlan!.closing.includes(p.box.slot),
        )
      : [];
  const phase = Math.min(minute / 48, 1);
  for (const role of ROLE_ORDER) {
    let best: Player | undefined,
      bestScore = -Infinity;
    for (const p of pool) {
      if (chosen.includes(p)) continue;
      // Assign every available requested closer a role before choosing foul-out cover.
      if (
        closers.some((closer) => !chosen.includes(closer)) &&
        !closers.includes(p)
      )
        continue;
      const foulThreshold =
        minute < 12 ? 2 : minute < 24 ? 3 : minute < 36 ? 4 : 5;
      const foulPenalty =
        minute < 43 && p.box.fouls >= foulThreshold
          ? 14 + (p.box.fouls - foulThreshold) * 9
          : 0;
      const debt = p.target * phase - Math.min(p.box.minutes, 48);
      const basketballScore = close
        ? p.profile.positions[POSITIONS[role]] * 0.85 +
          p.energy * 0.42 +
          p.profile.attributes.composure * 0.12 -
          foulPenalty * 0.2
        : p.profile.positions[POSITIONS[role]] * 0.5 +
          p.energy * 0.22 +
          p.target * 0.8 +
          debt * 5 -
          foulPenalty -
          Math.max(0, p.consecutive - 7) * 1.2;
      const score =
        basketballScore +
        (bonuses.get(p)?.[role] ?? 0) +
        (bonuses.size && team.floor[role] === p ? 1.5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    chosen[role] = best!;
  }
  const previous = team.floor;
  team.floor = chosen;
  if (minute > 0) recordCounters(team, previous, bonuses);
}

export function replaceFoulOut(
  team: Team,
  opponents: readonly Player[] = [],
): void {
  const eligible = eligiblePlayers(team);
  // Most fouls need no replacement, so avoid scouting again on every whistle.
  if (team.floor.every((p) => eligible.includes(p))) return;
  const bonuses = scoutLineup(team, opponents);
  const previous = [...team.floor];
  team.floor.forEach((p, role) => {
    if (eligible.includes(p)) return;
    const available = eligible.filter(
      (candidate) => !team.floor.includes(candidate),
    );
    available.sort(
      (a, b) =>
        b.profile.positions[POSITIONS[role]] +
        b.energy * 0.25 +
        (bonuses.get(b)?.[role] ?? 0) -
        (a.profile.positions[POSITIONS[role]] +
          a.energy * 0.25 +
          (bonuses.get(a)?.[role] ?? 0)),
    );
    team.floor[role] = available[0];
  });
  recordCounters(team, previous, bonuses);
}
