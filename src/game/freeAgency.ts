import { withRosterMastery } from "./abilityMastery";
import { withRosterMorale } from "./playerMorale";
import { withKnownBonds } from "./teammateChemistry";
import { POKEMON_BY_ID } from "../data/pokemon";
import { attributes, positionRating, teamRatings } from "./ratings";
import { clubTradeProfile } from "./tradeMarket";
import { compareTeamEvaluation } from "./teamEvaluation";
import { projectedCoaches } from "./coachOffice";
import type { DevelopmentRatings } from "./developmentTypes";
import type { Franchise } from "./franchiseTypes";
import { cpuRulesApply } from "./cpuRules";
import { recordOrder, seededRecordOrder } from "./draftLottery";
import {
  CPU_FREE_AGENT_SIGNINGS,
  USER_FREE_AGENT_SIGNINGS,
  MAX_FREE_AGENT_SIGNINGS,
  type FreeAgent,
  type FreeAgentEvaluation,
  type FreeAgentSigning,
} from "./freeAgencyTypes";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type Attributes,
  type GameState,
  type LeagueTeam,
  type Position,
  type RosterSlot,
} from "./types";

export function freeAgencyReady(f: Franchise): boolean {
  return (
    f.phase === "offseason" &&
    f.history.length === f.year &&
    f.history.at(-1)?.year === f.year &&
    !!f.offseasons?.some((r) => r.year === f.year) &&
    !!f.rookieDrafts?.some((d) => d.year === f.year && d.complete)
  );
}

const markets = new WeakMap<Franchise, FreeAgent[]>();
/** Reconstruct the market from releases; unopened prospects never enter it. */
export function freeAgentMarket(
  f: Franchise,
  includeLegends = true,
): FreeAgent[] {
  // Recheck ownership and developed offsets for modern edited snapshots.
  const modern = f.teams.some((team) => team.evaluationVersion === 1);
  let result = modern ? undefined : markets.get(f);
  if (!result) {
    const released = new Map<
      number,
      Pick<FreeAgent, "previousTeamId" | "releasedYear" | "releaseSource">
    >();
    for (const season of f.history) {
      for (const pick of f.rookieDrafts?.find((d) => d.year === season.year)
        ?.picks ?? [])
        released.set(pick.releasedId, {
          previousTeamId: pick.teamId,
          releasedYear: season.year,
          releaseSource: "draft",
        });
      for (const signing of f.freeAgency?.transactions.filter(
        (t) => t.year === season.year,
      ) ?? [])
        released.set(signing.releasedId, {
          previousTeamId: signing.teamId,
          releasedYear: season.year,
          releaseSource: "signing",
        });
    }
    const owned = new Set(f.teams.flatMap((t) => Object.values(t.roster)));
    const offsets = new Map<number, DevelopmentRatings>();
    for (const report of f.offseasons ?? [])
      for (const player of report.players) {
        const values = offsets.get(player.pokemonId) ?? {};
        for (const [key, delta] of Object.entries(player.changes)) {
          const skill = key as keyof DevelopmentRatings;
          const value = (values[skill] ?? 0) + delta;
          if (value) values[skill] = value;
          else delete values[skill];
        }
        offsets.set(player.pokemonId, values);
      }
    const mastery = new Map<number, number>();
    for (const season of f.history) {
      for (const roster of Object.values(
        season.replay?.playoffs.abilityMastery ?? {},
      ))
        for (const [id, xp] of Object.entries(roster))
          mastery.set(Number(id), xp);
      for (const row of f.offseasons?.find(
        (report) => report.year === season.year,
      )?.mastery ?? [])
        mastery.set(row.pokemonId, row.after);
    }
    result = [...released]
      .flatMap(([pokemonId, source]) => {
        const mon = POKEMON_BY_ID.get(pokemonId);
        if (!mon || owned.has(pokemonId)) return [];
        const development = { ...(offsets.get(pokemonId) ?? {}) };
        const fits = POSITIONS.map((p) => positionRating(mon, p, development));
        const rating = Math.max(...fits);
        return [
          {
            pokemonId,
            ...source,
            development,
            ...(f.teams[0].abilityMasteryVersion === 1
              ? { abilityMastery: mastery.get(pokemonId) ?? 0 }
              : {}),
            rating,
            position: POSITIONS[fits.indexOf(rating)],
          },
        ];
      })
      .sort((a, b) => b.rating - a.rating || a.pokemonId - b.pokemonId);
    if (!modern) markets.set(f, result);
  }
  return result.filter(
    (p) => includeLegends || !POKEMON_BY_ID.get(p.pokemonId)!.legendary,
  );
}

function replacePlayer(
  team: LeagueTeam,
  slot: RosterSlot,
  agent: FreeAgent,
  sources: readonly LeagueTeam[] = [team],
): LeagueTeam {
  const roster = { ...team.roster, [slot]: agent.pokemonId };
  const development = Object.fromEntries(
    ROSTER_SLOTS.map((s) => {
      const id = roster[s]!;
      return [
        id,
        {
          ...(id === agent.pokemonId
            ? agent.development
            : (team.development?.[id] ?? {})),
        },
      ];
    }),
  );
  return withRosterMastery(
    withRosterMorale(
      withKnownBonds(
        {
          ...team,
          roster,
          development,
          ratings: teamRatings(
            roster,
            team.tactic,
            team.rotation,
            development,
            team.rotationPlan,
          ),
        },
        sources,
      ),
      team,
      sources,
      "free-agent",
    ),
    team,
    sources,
    "free-agent",
    { [agent.pokemonId]: agent.abilityMastery ?? 0 },
  );
}
function skillProfile(id: number, offsets: DevelopmentRatings = {}) {
  const mon = POKEMON_BY_ID.get(id)!;
  const fits = Object.fromEntries(
    POSITIONS.map((p) => [p, positionRating(mon, p, offsets)]),
  ) as Record<Position, number>;
  return {
    a: attributes(mon, offsets),
    fits,
    best: Math.max(...Object.values(fits)),
  };
}
function scheme(team: LeagueTeam, a: Attributes) {
  const offense =
    team.tactic === "perimeter"
      ? a.threePoint
      : team.tactic === "interior"
        ? (a.finishing + a.strength) / 2
        : team.tactic === "pace"
          ? (a.speed + a.stamina) / 2
          : team.tactic === "defense"
            ? (a.perimeterDefense + a.interiorDefense) / 2
            : (a.shooting + a.playmaking + a.finishing) / 3;
  const defense =
    team.defense === "zone"
      ? a.interiorDefense
      : team.defense === "press"
        ? (a.steal + a.speed + a.stamina) / 3
        : team.defense === "switch"
          ? Math.min(a.perimeterDefense, a.interiorDefense)
          : (a.perimeterDefense + a.interiorDefense) / 2;
  return (offense + defense) / 2;
}
function fitScore(
  team: LeagueTeam,
  slot: RosterSlot,
  incoming: ReturnType<typeof skillProfile>,
  outgoing: ReturnType<typeof skillProfile>,
) {
  const fit = (p: typeof incoming) =>
    POSITIONS.includes(slot as Position) ? p.fits[slot as Position] : p.best;
  return {
    fitChange: fit(incoming) - fit(outgoing),
    score:
      (fit(incoming) - fit(outgoing)) * 0.7 +
      (incoming.best - outgoing.best) * 0.3 +
      (scheme(team, incoming.a) - scheme(team, outgoing.a)) * 0.25,
  };
}

/** User signings already made in the current offseason. */
export function userSigningsThisYear(f: Franchise): number {
  return (
    f.freeAgency?.transactions.filter(
      (t) => t.year === f.year && t.source === "user",
    ).length ?? 0
  );
}

export function evaluateFreeAgentSigning(
  f: Franchise,
  teamId: number,
  pokemonId: number,
  releasedId: number,
  includeLegends = true,
): FreeAgentEvaluation {
  const actualTeam = f.teams.find((t) => t.id === teamId);
  const team =
    actualTeam?.evaluationVersion === 1
      ? projectedCoaches(f.teams, f.coachOffice, f.year).find(
          (t) => t.id === teamId,
        )
      : actualTeam;
  const base = {
    teamBefore: team?.ratings.overall ?? 0,
    teamAfter: team?.ratings.overall ?? 0,
    fitChange: 0,
    score: 0,
  };
  const reject = (reason: string): FreeAgentEvaluation => ({
    ...base,
    eligible: false,
    reason,
  });
  if (!freeAgencyReady(f))
    return reject(
      "Complete this offseason's development and rookie draft before signing free agents.",
    );
  if ((f.freeAgency?.transactions.length ?? 0) >= MAX_FREE_AGENT_SIGNINGS)
    return reject(
      "This franchise has reached its free-agent transaction limit.",
    );
  if (!team || f.teams.length !== 30 || f.teams.some((t, i) => t.id !== i))
    return reject("The league roster is unavailable.");
  if (teamId === 0 && cpuRulesApply(f)) {
    if (!f.freeAgency?.cpuYears.includes(f.year))
      return reject("CPU clubs make their free-agent moves first.");
    if (userSigningsThisYear(f) >= USER_FREE_AGENT_SIGNINGS)
      return reject(
        `Clubs may sign ${USER_FREE_AGENT_SIGNINGS} free agents per offseason. Your signings are complete until next year.`,
      );
  }
  const all = f.teams.flatMap((t) => ROSTER_SLOTS.map((s) => t.roster[s]));
  if (
    new Set(all).size !== 240 ||
    all.some((id) => id == null || !POKEMON_BY_ID.has(id))
  )
    return reject("Every team needs eight unique players.");
  const slot = ROSTER_SLOTS.find((s) => team.roster[s] === releasedId);
  if (!slot)
    return reject(
      "Choose a player currently on this team's roster to release.",
    );
  const agent = freeAgentMarket(f, includeLegends).find(
    (p) => p.pokemonId === pokemonId,
  );
  if (!agent)
    return reject("That Pokémon is no longer an available free agent.");
  const next = replacePlayer(team, slot, agent, f.teams);
  if (team.evaluationVersion === 1) {
    const shared = compareTeamEvaluation(team, next);
    return {
      eligible: true,
      teamBefore: shared.before,
      teamAfter: shared.after,
      fitChange:
        shared.factors.find((factor) => factor.label === "Rotation role fit")
          ?.change ?? 0,
      score: shared.delta,
      factors: shared.factors,
      reason: `${POKEMON_BY_ID.get(pokemonId)!.name} replaces ${POKEMON_BY_ID.get(releasedId)!.name} at ${slot}. Shared team value ${shared.delta >= 0 ? "+" : ""}${shared.delta.toFixed(2)}. ${[
        ...shared.factors,
      ]
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, 2)
        .map(
          (factor) =>
            `${factor.label} ${factor.contribution >= 0 ? "+" : ""}${factor.contribution.toFixed(2)}`,
        )
        .join("; ")}.`,
    };
  }
  const scored = fitScore(
    team,
    slot,
    skillProfile(pokemonId, agent.development),
    skillProfile(releasedId, team.development?.[releasedId]),
  );
  const delta = next.ratings.overall - team.ratings.overall;
  return {
    eligible: true,
    teamBefore: team.ratings.overall,
    teamAfter: next.ratings.overall,
    fitChange: scored.fitChange,
    score: scored.score + delta * 2,
    reason: `${POKEMON_BY_ID.get(pokemonId)!.name} replaces ${POKEMON_BY_ID.get(releasedId)!.name} at ${slot}. Position fit ${scored.fitChange >= 0 ? "+" : ""}${scored.fitChange.toFixed(1)}; team overall ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}.`,
  };
}

function recordSigning(
  f: Franchise,
  teamId: number,
  agent: FreeAgent,
  releasedId: number,
  source: FreeAgentSigning["source"],
  reason: string,
): Franchise {
  const team = f.teams[teamId],
    slot = ROSTER_SLOTS.find((s) => team.roster[s] === releasedId)!;
  return {
    ...f,
    modelVersion: 3,
    teams: f.teams.map((t) =>
      t.id === teamId ? replacePlayer(t, slot, agent, f.teams) : t,
    ),
    freeAgency: {
      modelVersion: 1,
      cpuYears: f.freeAgency?.cpuYears ?? [],
      transactions: [
        ...(f.freeAgency?.transactions ?? []),
        {
          year: f.year,
          teamId,
          pokemonId: agent.pokemonId,
          releasedId,
          tradeIndex: f.trades.length,
          source,
          reason,
        },
      ],
    },
    ...(teamId === 0 && f.trainingPlans
      ? {
          trainingPlans: Object.fromEntries(
            Object.entries(f.trainingPlans).filter(
              ([id]) => Number(id) !== releasedId,
            ),
          ),
        }
      : {}),
  };
}
export function signFreeAgent(
  state: GameState,
  pokemonId: number,
  releasedId: number,
): GameState {
  const f = state.franchise;
  if (!f) return state;
  const evaluation = evaluateFreeAgentSigning(
    f,
    0,
    pokemonId,
    releasedId,
    state.run.includeLegends,
  );
  if (!evaluation.eligible) return state;
  const agent = freeAgentMarket(f, state.run.includeLegends).find(
    (p) => p.pokemonId === pokemonId,
  )!;
  return {
    ...state,
    franchise: recordSigning(
      f,
      0,
      agent,
      releasedId,
      "user",
      evaluation.reason,
    ),
  };
}

/** A CPU club's preferred signing for a waiver round, or null when none clears its bar. */
export function cpuFreeAgentChoice(
  f: Franchise,
  teamId: number,
  round: number,
  includeLegends = true,
): {
  agent: FreeAgent;
  releasedId: number;
  evaluation: FreeAgentEvaluation;
} | null {
  const actualTeam = f.teams[teamId];
  const team =
    actualTeam.evaluationVersion === 1
      ? projectedCoaches(f.teams, f.coachOffice, f.year)[teamId]
      : actualTeam;
  const pool = freeAgentMarket(f, includeLegends);
  const protectedRookies = new Set(
    f.rookieDrafts
      ?.find((d) => d.year === f.year)
      ?.picks.map((p) => p.pokemonId),
  );
  const outgoing = ROSTER_SLOTS.filter(
    (s) => !protectedRookies.has(team.roster[s]!),
  ).map((slot) => ({
    slot,
    id: team.roster[slot]!,
    profile: skillProfile(
      team.roster[slot]!,
      team.development?.[team.roster[slot]!],
    ),
  }));
  const options = pool
    .flatMap((agent) => {
      const profile = skillProfile(agent.pokemonId, agent.development);
      return outgoing.map((out) => ({
        agent,
        releasedId: out.id,
        score:
          team.evaluationVersion === 1
            ? compareTeamEvaluation(
                team,
                replacePlayer(team, out.slot, agent, f.teams),
              ).delta
            : fitScore(team, out.slot, profile, out.profile).score,
      }));
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.agent.pokemonId - b.agent.pokemonId ||
        a.releasedId - b.releasedId,
    )
    .slice(0, 6);
  // Shared-evaluation clubs score on a smaller scale (team value delta).
  const bar = team.evaluationVersion === 1 ? 0.15 : 2;
  return (
    options
      .map((option) => ({
        agent: option.agent,
        releasedId: option.releasedId,
        evaluation: evaluateFreeAgentSigning(
          f,
          teamId,
          option.agent.pokemonId,
          option.releasedId,
          includeLegends,
        ),
      }))
      // A later round (rules v1) needs a clearly better player and lineup.
      .filter(
        (o) =>
          o.evaluation.eligible &&
          (round === 0
            ? o.evaluation.score >= bar &&
              o.evaluation.teamAfter >= o.evaluation.teamBefore - 0.15
            : o.evaluation.score >= 2 * bar &&
              o.evaluation.teamAfter >= o.evaluation.teamBefore + 0.1),
      )
      .sort(
        (a, b) =>
          b.evaluation.score - a.evaluation.score ||
          a.agent.pokemonId - b.agent.pokemonId ||
          a.releasedId - b.releasedId,
      )[0] ?? null
  );
}

/**
 * Deterministic waiver rounds, worst record first. Rules v1 adds a second
 * round (seeded ties) so a club can make another, clearly better, signing
 * after every club has had a first chance. A failed upgrade leaves the roster intact.
 */
export function processCpuFreeAgency(state: GameState): GameState {
  let f = state.franchise;
  if (!f || !freeAgencyReady(f) || f.freeAgency?.cpuYears.includes(f.year))
    return state;
  const season = f.history.at(-1)!,
    fair = cpuRulesApply(f);
  const order = (
    fair
      ? seededRecordOrder(season.standings, season.seasonSeed)
      : recordOrder(season.standings)
  ).filter((id) => id !== 0);
  const rounds = fair ? CPU_FREE_AGENT_SIGNINGS : 1;
  for (let round = 0; round < rounds; round++)
    for (const teamId of order) {
      const best = cpuFreeAgentChoice(
        f,
        teamId,
        round,
        state.run.includeLegends,
      );
      if (best)
        f = recordSigning(
          f,
          teamId,
          best.agent,
          best.releasedId,
          "cpu",
          `${clubTradeProfile(f, teamId).title}: ${best.evaluation.reason}`,
        );
    }
  return {
    ...state,
    franchise: {
      ...f,
      freeAgency: {
        modelVersion: 1,
        transactions: f.freeAgency?.transactions ?? [],
        cpuYears: [...(f.freeAgency?.cpuYears ?? []), f.year],
      },
    },
  };
}
