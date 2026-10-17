import { withRosterMastery, masteryXp } from "./abilityMastery";
import { withRosterMorale } from "./playerMorale";
import { withKnownBonds } from "./teammateChemistry";
import { POKEMON_BY_ID } from "../data/pokemon";
import { teamRatings, positionRating } from "./ratings";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type LeagueTeam,
  type Position,
} from "./types";
import type { FranchiseTrade } from "./franchiseTypes";
import { CPU_TRADE_LIMIT, type PlayerDevelopment } from "./developmentTypes";
import { nextRandom } from "./random";
import {
  compareTeamEvaluation,
  createEvaluationContext,
  evaluatePlayer,
  evaluateTeam,
} from "./teamEvaluation";

/** Move skill development with the species; historical season snapshots are untouched. */
export function exchangePlayers(
  teams: LeagueTeam[],
  fromTeamId: number,
  teamId: number,
  giveId: number,
  receiveId: number,
): LeagueTeam[] {
  const source = teams[fromTeamId],
    partner = teams[teamId];
  return teams.map((team) => {
    if (team.id !== fromTeamId && team.id !== teamId) return team;
    const from = team.id === fromTeamId ? giveId : receiveId;
    const to = team.id === fromTeamId ? receiveId : giveId;
    const other = team.id === fromTeamId ? partner : source;
    const slot = ROSTER_SLOTS.find((s) => team.roster[s] === from)!;
    const roster = { ...team.roster, [slot]: to };
    let development: PlayerDevelopment | undefined;
    if (
      team.development ||
      (team.evaluationVersion === 1 && other.development)
    ) {
      development = {
        ...team.development,
        [to]: { ...(other.development?.[to] ?? {}) },
      };
      delete development[from];
    }
    return withRosterMastery(
      withRosterMorale(
        withKnownBonds(
          {
            ...team,
            roster,
            ...(development ? { development } : {}),
            ratings: teamRatings(
              roster,
              team.tactic,
              team.rotation,
              development,
              team.rotationPlan,
            ),
          },
          teams,
        ),
        team,
        teams,
        "trade",
      ),
      team,
      teams,
      "trade",
    );
  });
}

export function cpuTrades(
  teams: LeagueTeam[],
  year: number,
  seasonSeed: number,
  limit = CPU_TRADE_LIMIT,
): { teams: LeagueTeam[]; trades: FranchiseTrade[] } {
  const allDevelopment: PlayerDevelopment = Object.assign(
    {},
    ...teams.map((t) => t.development),
  );
  const profiles = new Map(
    teams.flatMap((team) =>
      Object.values(team.roster).map((id) => {
        const positions = Object.fromEntries(
          POSITIONS.map((pos) => [
            pos,
            positionRating(POKEMON_BY_ID.get(id!)!, pos, allDevelopment[id!]),
          ]),
        ) as Record<Position, number>;
        return [
          id!,
          { positions, best: Math.max(...Object.values(positions)) },
        ] as const;
      }),
    ),
  );
  const allMastery = Object.fromEntries(
    teams.flatMap((team) =>
      Object.values(team.roster).map((id) => [id!, masteryXp(team, id!)]),
    ),
  );
  const sharedContexts = new Map(
    teams
      .filter((team) => team.evaluationVersion === 1)
      .map((team) => {
        const context = createEvaluationContext(team);
        return [
          team.id,
          context.mastery ? { ...context, mastery: allMastery } : context,
        ] as const;
      }),
  );
  const sharedValues = new Map<string, number>();
  const sharedValue = (team: LeagueTeam, id: number, slot: string) => {
    const key = `${team.id}:${id}:${slot}`;
    let value = sharedValues.get(key);
    if (value === undefined) {
      value = evaluatePlayer(
        sharedContexts.get(team.id)!,
        id,
        POSITIONS.includes(slot as Position) ? (slot as Position) : undefined,
        allDevelopment[id] ?? {},
      ).score;
      sharedValues.set(key, value);
    }
    return value;
  };
  let seed = (seasonSeed ^ Math.imul(year, 0x51c8a361)) >>> 0;
  const roll = () => {
    const next = nextRandom(seed);
    seed = next.seed;
    return next.value;
  };
  const candidates: {
    first: number;
    second: number;
    give: number;
    receive: number;
    aGain: number;
    bGain: number;
    score: number;
  }[] = [];
  for (let first = 1; first < teams.length; first++)
    for (let second = first + 1; second < teams.length; second++) {
      const a = teams[first],
        b = teams[second];
      const options: { give: number; receive: number; potential: number }[] =
        [];
      for (const aSlot of ROSTER_SLOTS)
        for (const bSlot of ROSTER_SLOTS) {
          const give = a.roster[aSlot]!,
            receive = b.roster[bSlot]!,
            ap = profiles.get(give)!,
            bp = profiles.get(receive)!;
          if (Math.abs(ap.best - bp.best) > 6) continue;
          const fit = (team: LeagueTeam, id: number, slot: string) =>
            team.evaluationVersion === 1
              ? sharedValue(team, id, slot)
              : POSITIONS.includes(slot as Position)
                ? profiles.get(id)!.positions[slot as Position]
                : profiles.get(id)!.best;
          const aFit = fit(a, receive, aSlot) - fit(a, give, aSlot),
            bFit = fit(b, give, bSlot) - fit(b, receive, bSlot);
          options.push({ give, receive, potential: aFit + bFit });
        }
      // Shortlist the two strongest positional fits per club pair before the
      // full rotation evaluation, keeping league negotiations responsive.
      // Spacing or depth can improve even when the vacant-slot fit is flat.
      options.sort(
        (a, b) =>
          b.potential - a.potential || a.give - b.give || a.receive - b.receive,
      );
      for (const { give, receive } of options.slice(0, 2)) {
        const swapped = exchangePlayers(teams, first, second, give, receive);
        const aGain =
            a.evaluationVersion === 1
              ? compareTeamEvaluation(a, swapped[first]).delta
              : swapped[first].ratings.overall - a.ratings.overall,
          bGain =
            b.evaluationVersion === 1
              ? compareTeamEvaluation(b, swapped[second]).delta
              : swapped[second].ratings.overall - b.ratings.overall;
        const ability = profiles.get(receive)!.best - profiles.get(give)!.best;
        if (
          aGain < 0.05 ||
          bGain < 0.05 ||
          aGain + bGain < 0.15 ||
          (a.evaluationVersion !== 1 && ability + 2 * aGain < -2.5) ||
          (b.evaluationVersion !== 1 && -ability + 2 * bGain < -2.5)
        )
          continue;
        candidates.push({
          first,
          second,
          give,
          receive,
          aGain,
          bGain,
          score: aGain + bGain + roll() * 0.35,
        });
      }
    }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.first - b.first ||
      a.second - b.second ||
      a.give - b.give,
  );
  const used = new Set<number>(),
    trades: FranchiseTrade[] = [];
  let updated = teams;
  for (const candidate of candidates) {
    if (trades.length >= Math.min(CPU_TRADE_LIMIT, limit)) break;
    const { first, second, give, receive, aGain, bGain } = candidate;
    if (used.has(first) || used.has(second)) continue;
    updated = exchangePlayers(updated, first, second, give, receive);
    used.add(first);
    used.add(second);
    trades.push({
      year,
      fromTeamId: first,
      teamId: second,
      giveId: give,
      receiveId: receive,
      source: "cpu",
      reason:
        teams[first].evaluationVersion === 1 &&
        teams[second].evaluationVersion === 1
          ? `Both clubs improve their shared team value: ${teams[first].name} +${aGain.toFixed(2)}, ${teams[second].name} +${bGain.toFixed(2)}.`
          : `Both clubs improve their rotation fit: ${teams[first].name} +${aGain.toFixed(1)}, ${teams[second].name} +${bGain.toFixed(1)} in roster rating.`,
    });
  }
  return { teams: updated, trades };
}

/** Exchange equal packages, assigning incoming players only to the vacated slots. */
export function exchangePackage(
  teams: LeagueTeam[],
  fromTeamId: number,
  teamId: number,
  giveIds: number[],
  receiveIds: number[],
): LeagueTeam[] {
  const source = teams.find((team) => team.id === fromTeamId),
    partner = teams.find((team) => team.id === teamId);
  const owns = (team: LeagueTeam, ids: number[]) =>
    ids.every(
      (id) => POKEMON_BY_ID.has(id) && Object.values(team.roster).includes(id),
    );
  if (
    !source ||
    !partner ||
    source === partner ||
    !Array.isArray(giveIds) ||
    !Array.isArray(receiveIds) ||
    giveIds.length < 1 ||
    giveIds.length > 3 ||
    giveIds.length !== receiveIds.length ||
    new Set([...giveIds, ...receiveIds]).size !== giveIds.length * 2 ||
    !owns(source, giveIds) ||
    !owns(partner, receiveIds)
  )
    return teams;
  const replace = (
    team: LeagueTeam,
    other: LeagueTeam,
    outgoing: number[],
    incoming: number[],
  ): LeagueTeam => {
    const slots = ROSTER_SLOTS.filter((slot) =>
      outgoing.includes(team.roster[slot]!),
    );
    const candidates = [...incoming].sort((a, b) => a - b);
    const fits = new Map(
      candidates.map((id) => [
        id,
        POSITIONS.map((position) =>
          positionRating(
            POKEMON_BY_ID.get(id)!,
            position,
            other.development?.[id],
          ),
        ),
      ]),
    );
    let best = candidates,
      bestScore = -Infinity;
    const assign = (order: number[], remaining: number[]) => {
      if (remaining.length) {
        for (const id of remaining)
          assign(
            [...order, id],
            remaining.filter((candidate) => candidate !== id),
          );
        return;
      }
      const legacyScore = () =>
        order.reduce((sum, id, index) => {
          const slot = slots[index],
            starter = POSITIONS.indexOf(slot as Position),
            ratings = fits.get(id)!;
          const minutes =
            team.rotationPlan?.minutes[slot] ?? (starter >= 0 ? 34 : 23);
          return (
            sum +
            (starter >= 0 ? ratings[starter] : Math.max(...ratings)) * minutes
          );
        }, 0);
      const score =
        team.evaluationVersion === 1
          ? evaluateTeam(
              withRosterMastery(
                withRosterMorale(
                  withKnownBonds(
                    {
                      ...team,
                      roster: {
                        ...team.roster,
                        ...Object.fromEntries(
                          slots.map((slot, index) => [slot, order[index]]),
                        ),
                      },
                      development: {
                        ...team.development,
                        ...Object.fromEntries(
                          incoming.map((id) => [
                            id,
                            other.development?.[id] ?? {},
                          ]),
                        ),
                      },
                    },
                    teams,
                  ),
                  team,
                  teams,
                  "trade",
                ),
                team,
                teams,
                "trade",
              ),
            ).score
          : legacyScore();
      if (score > bestScore + 1e-9) {
        best = order;
        bestScore = score;
      }
    };
    assign([], candidates);
    const roster = { ...team.roster };
    slots.forEach((slot, index) => {
      roster[slot] = best[index];
    });
    const development: PlayerDevelopment | undefined =
      team.development || other.development
        ? { ...team.development }
        : undefined;
    if (development) {
      outgoing.forEach((id) => {
        delete development[id];
      });
      incoming.forEach((id) => {
        development[id] = { ...(other.development?.[id] ?? {}) };
      });
    }
    return withRosterMastery(
      withRosterMorale(
        withKnownBonds(
          {
            ...team,
            roster,
            ...(development ? { development } : {}),
            ratings: teamRatings(
              roster,
              team.tactic,
              team.rotation,
              development,
              team.rotationPlan,
            ),
          },
          teams,
        ),
        team,
        teams,
        "trade",
      ),
      team,
      teams,
      "trade",
    );
  };
  return teams.map((team) =>
    team.id === fromTeamId
      ? replace(team, partner, giveIds, receiveIds)
      : team.id === teamId
        ? replace(team, source, receiveIds, giveIds)
        : team,
  );
}
