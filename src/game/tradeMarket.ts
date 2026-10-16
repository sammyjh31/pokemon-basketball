import { createRivalStrategy, type RivalStrategy } from "./rivalRosterStrategy";
import { POKEMON_BY_ID } from "../data/pokemon";
import { attributes, positionRating, teamRatings } from "./ratings";
import { exchangePackage } from "./rosterTrades";
import {
  FRANCHISE_MAX_TRADES,
  type Franchise,
  type FranchiseTrade,
} from "./franchiseTypes";
import {
  POSITIONS,
  ROSTER_SLOTS,
  TACTIC_LABELS,
  DEFENSE_LABELS,
  SLOT_NAMES,
  type Attributes,
  type LeagueTeam,
  type Position,
} from "./types";
import type {
  ClubTradeProfile,
  PackageEvaluation,
  TradeAvailability,
  TradeMarketPlayer,
  TradePackage,
  TradeSuggestion,
  SuggestionOptions,
  TradeFactor,
} from "./tradeTypes";

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);
const rosterIds = (team: LeagueTeam) =>
  ROSTER_SLOTS.map((slot) => team.roster[slot]!);
const draftInProgress = (franchise: Franchise) =>
  franchise.rookieDrafts?.at(-1)?.year === franchise.year &&
  !franchise.rookieDrafts.at(-1)!.complete;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
interface PlayerProfile {
  id: number;
  a: Attributes;
  fits: number[];
  best: number;
  position: Position;
  trend: number;
}
interface Context {
  players: Map<number, PlayerProfile>;
  strategies: Map<number, RivalStrategy>;
  valid: boolean;
  profiles: Map<number, ClubTradeProfile>;
  ratings: Map<number, ReturnType<typeof teamRatings>>;
  availability: Map<number, TradeAvailability>;
}
// Franchise snapshots are immutable in the reducer. Reuse factual skill profiles
// during a bounded search; execution receives a fresh snapshot after any edit.
const contexts = new WeakMap<Franchise, Context>();
function context(franchise: Franchise): Context {
  const cached = contexts.get(franchise);
  if (cached) return cached;
  const trends = new Map<number, number>();
  for (const report of [...(franchise.offseasons ?? [])].sort(
    (a, b) => b.year - a.year,
  ))
    for (const player of report.players)
      if (!trends.has(player.pokemonId))
        trends.set(player.pokemonId, player.after - player.before);
  const players = new Map<number, PlayerProfile>(),
    ratings = new Map<number, ReturnType<typeof teamRatings>>();
  const allIds = franchise.teams.flatMap(rosterIds);
  const valid =
    franchise.teams.length === 30 &&
    new Set(franchise.teams.map((team) => team.id)).size === 30 &&
    franchise.teams.every((team, index) => team.id === index) &&
    allIds.length === 240 &&
    new Set(allIds).size === 240 &&
    allIds.every((id) => Number.isInteger(id) && POKEMON_BY_ID.has(id));
  if (valid)
    for (const team of franchise.teams) {
      for (const id of rosterIds(team)) {
        const mon = POKEMON_BY_ID.get(id)!,
          development = team.development?.[id];
        const fits = POSITIONS.map((position) =>
          positionRating(mon, position, development),
        );
        const best = Math.max(...fits);
        players.set(id, {
          id,
          a: attributes(mon, development),
          fits,
          best,
          position: POSITIONS[fits.indexOf(best)],
          trend: trends.get(id) ?? 0,
        });
      }
      ratings.set(
        team.id,
        teamRatings(
          team.roster,
          team.tactic,
          team.rotation,
          team.development,
          team.rotationPlan,
        ),
      );
    }
  const result: Context = {
    players,
    strategies: new Map(),
    valid,
    ratings,
    profiles: new Map(),
    availability: new Map(),
  };
  contexts.set(franchise, result);
  return result;
}

function strategy(
  franchise: Franchise,
  team: LeagueTeam,
  ctx = context(franchise),
) {
  let plan = ctx.strategies.get(team.id);
  if (!plan) {
    plan = createRivalStrategy(
      team,
      franchise.teams,
      franchise.history,
      franchise.year,
    );
    ctx.strategies.set(team.id, plan);
  }
  return plan;
}

export function clubTradeProfile(
  franchise: Franchise,
  teamId: number,
): ClubTradeProfile {
  const team = franchise.teams.find((t) => t.id === teamId),
    last = franchise.history.at(-1);
  const record = last?.standings.find((standing) => standing.teamId === teamId);
  const winRate = record
    ? record.wins / Math.max(1, record.wins + record.losses)
    : 0.5;
  const champion = last?.championId === teamId;
  const direction =
    champion || winRate >= 0.59
      ? "contend"
      : winRate < 0.42
        ? "develop"
        : "retool";
  const title =
    direction === "contend"
      ? "Contending"
      : direction === "develop"
        ? "Developing"
        : "Retooling";
  const priorities =
    direction === "contend"
      ? ["Immediate rotation upgrades", "Preserve core continuity"]
      : direction === "develop"
        ? ["Recent development upside", "Build positional depth"]
        : ["Address weak roster skills", "Find better scheme fits"];
  if (team)
    priorities.push(
      `${TACTIC_LABELS[team.tactic]} offense`,
      `${DEFENSE_LABELS[team.defense]} defense`,
    );
  const scouting = team ? strategy(franchise, team) : undefined;
  if (scouting?.active)
    priorities.push(...scouting.rivals.map((r) => `Counter ${r.name}`));
  return {
    teamId,
    direction,
    title,
    priorities,
    reason:
      (champion
        ? "The reigning champion values its proven core and immediate improvement."
        : record
          ? `${record.wins}–${record.losses} last season: ${direction === "contend" ? "prioritize a stronger rotation for another playoff run" : direction === "develop" ? "seek improving players and deeper positional coverage" : "rebalance skills and scheme fit"}.`
          : "No completed record yet; seek balanced value and better roster fit.") +
      (scouting?.active ? ` ${scouting.explanation}` : ""),
  };
}
function profile(franchise: Franchise, team: LeagueTeam, ctx: Context) {
  let value = ctx.profiles.get(team.id);
  if (!value) {
    value = clubTradeProfile(franchise, team.id);
    ctx.profiles.set(team.id, value);
  }
  return value;
}
function availability(
  franchise: Franchise,
  team: LeagueTeam,
  id: number,
  ctx: Context,
): TradeAvailability {
  const cached = ctx.availability.get(id);
  if (cached) return cached;
  const byTalent = rosterIds(team).sort(
    (a, b) => ctx.players.get(b)!.best - ctx.players.get(a)!.best || a - b,
  );
  const rank = byTalent.indexOf(id),
    starter = POSITIONS.some((slot) => team.roster[slot] === id);
  const current = ctx.players.get(id)!;
  const direction = profile(franchise, team, ctx).direction;
  const value =
    rank < 2 || (direction === "develop" && current.trend >= 3 && rank < 5)
      ? "core"
      : !starter || current.trend <= -3
        ? "available"
        : "listening";
  ctx.availability.set(id, value);
  return value;
}
export function tradeMarketPlayers(franchise: Franchise): TradeMarketPlayer[] {
  const ctx = context(franchise);
  if (!ctx.valid) return [];
  return franchise.teams
    .filter((team) => team.id !== 0)
    .flatMap((team) =>
      ROSTER_SLOTS.map((slot) => {
        const id = team.roster[slot]!,
          player = ctx.players.get(id)!,
          status = availability(franchise, team, id, ctx);
        return {
          pokemonId: id,
          teamId: team.id,
          position: player.position,
          rating: player.best,
          availability: status,
          role: SLOT_NAMES[slot],
          trend: player.trend,
          reason:
            status === "core"
              ? "A leading talent or rising building block; requires a clear value premium."
              : status === "available"
                ? "Open to a fair offer that improves depth or fit; a lower asking price."
                : "Part of the rotation; comparable ability plus a useful roster fit can persuade the club.",
        };
      }),
    );
}
function coaching(team: LeagueTeam, ids: number[], ctx: Context): number {
  return average(
    ids.map((id) => {
      const a = ctx.players.get(id)!.a;
      const offense =
        team.tactic === "perimeter"
          ? 0.75 * a.threePoint + 0.25 * a.passing
          : team.tactic === "interior"
            ? 0.6 * a.finishing + 0.4 * a.offensiveRebound
            : team.tactic === "pace"
              ? 0.6 * a.speed + 0.4 * a.stamina
              : team.tactic === "defense"
                ? average([a.perimeterDefense, a.interiorDefense, a.rebounding])
                : average([a.shooting, a.playmaking, a.finishing]);
      const defense =
        team.defense === "switch"
          ? 0.6 * a.perimeterDefense + 0.4 * a.speed
          : team.defense === "zone"
            ? 0.6 * a.interiorDefense + 0.4 * a.block
            : team.defense === "press"
              ? average([a.speed, a.steal, a.stamina])
              : average([a.perimeterDefense, a.interiorDefense]);
      return 0.65 * offense + 0.35 * defense;
    }),
  );
}
function depth(ids: number[], ctx: Context): number {
  return average(
    POSITIONS.map((_, index) => {
      const fits = ids
        .map((id) => ctx.players.get(id)!.fits[index])
        .sort((a, b) => b - a);
      return 0.4 * fits[0] + 0.6 * fits[1];
    }),
  );
}
const NEEDS = [
  "shooting",
  "playmaking",
  "perimeterDefense",
  "interiorDefense",
  "rebounding",
] as const;
function weaknessChange(
  before: number[],
  after: number[],
  ctx: Context,
): { delta: number; names: string[] } {
  const baseline = NEEDS.map((key) => ({
    key,
    value: average(before.map((id) => ctx.players.get(id)!.a[key])),
  })).sort((a, b) => a.value - b.value);
  const needs = baseline.slice(0, 2);
  return {
    delta: average(
      needs.map(
        ({ key, value }) =>
          average(after.map((id) => ctx.players.get(id)!.a[key])) - value,
      ),
    ),
    names: needs.map(({ key }) => key.replace(/([A-Z])/g, " $1").toLowerCase()),
  };
}
function talentFloor(give: number[], receive: number[], ctx: Context): boolean {
  const incoming = give
      .map((id) => ctx.players.get(id)!.best)
      .sort((a, b) => b - a),
    outgoing = receive
      .map((id) => ctx.players.get(id)!.best)
      .sort((a, b) => b - a);
  return (
    average(incoming) - average(outgoing) >= -5 &&
    incoming[0] - outgoing[0] >= -6 &&
    incoming.every((rating, index) => rating - outgoing[index] >= -9)
  );
}

export function evaluateTradePackage(
  franchise: Franchise,
  offer: TradePackage,
  fromTeamId = 0,
): PackageEvaluation {
  const club = clubTradeProfile(franchise, offer.teamId);
  const result: PackageEvaluation = {
    accepted: false,
    reason: "",
    outgoingValue: 0,
    incomingValue: 0,
    partnerBefore: 0,
    partnerAfter: 0,
    factors: [],
    profile: club,
    score: 0,
    threshold: 0,
    userDelta: 0,
  };
  const reject = (reason: string) => ({ ...result, accepted: false, reason });
  if (franchise.phase !== "offseason")
    return reject("Trades are available only during the offseason.");
  if (draftInProgress(franchise))
    return reject("Complete the current rookie draft before trading.");
  if (franchise.trades.length >= FRANCHISE_MAX_TRADES)
    return reject("The franchise has reached its 10,000-trade save limit.");
  const ctx = context(franchise);
  if (!ctx.valid)
    return reject(
      "The league needs 30 complete rosters and 240 distinct Pokémon.",
    );
  const source = franchise.teams[fromTeamId],
    partner = franchise.teams[offer.teamId];
  if (!source || !partner || source.id === partner.id)
    return reject("Choose two different clubs.");
  if (
    !Array.isArray(offer.giveIds) ||
    !Array.isArray(offer.receiveIds) ||
    offer.giveIds.length < 1 ||
    offer.giveIds.length > 3 ||
    offer.giveIds.length !== offer.receiveIds.length ||
    new Set([...offer.giveIds, ...offer.receiveIds]).size !==
      offer.giveIds.length * 2 ||
    !offer.giveIds.every((id) => rosterIds(source).includes(id)) ||
    !offer.receiveIds.every((id) => rosterIds(partner).includes(id))
  )
    return reject(
      "Choose equal packages of one, two or three distinct players currently owned by each club.",
    );
  const give = sorted(offer.giveIds),
    receive = sorted(offer.receiveIds);
  result.outgoingValue = give.reduce(
    (sum, id) => sum + ctx.players.get(id)!.best,
    0,
  );
  result.incomingValue = receive.reduce(
    (sum, id) => sum + ctx.players.get(id)!.best,
    0,
  );
  result.partnerBefore = ctx.ratings.get(partner.id)!.overall;
  const traded = exchangePackage(
    franchise.teams,
    fromTeamId,
    offer.teamId,
    give,
    receive,
  );
  result.partnerAfter = traded[partner.id].ratings.overall;
  result.userDelta =
    traded[source.id].ratings.overall - ctx.ratings.get(source.id)!.overall;
  const beforeIds = rosterIds(partner),
    afterIds = rosterIds(traded[partner.id]);
  const abilityChange =
    (result.outgoingValue - result.incomingValue) / give.length;
  const fitChange = result.partnerAfter - result.partnerBefore;
  const schemeChange =
    coaching(partner, give, ctx) - coaching(partner, receive, ctx);
  const depthChange = depth(afterIds, ctx) - depth(beforeIds, ctx);
  const needs = weaknessChange(beforeIds, afterIds, ctx);
  const trend =
    average(give.map((id) => ctx.players.get(id)!.trend)) -
    average(receive.map((id) => ctx.players.get(id)!.trend));
  const champion = franchise.history.at(-1)?.championId === partner.id;
  const established = receive.filter((id) =>
    franchise.history.at(-1)?.rosters[partner.id]?.includes(id),
  ).length;
  const continuity = champion
    ? -0.35 * established
    : club.direction === "contend"
      ? -0.12 * established
      : 0;
  const factor = (
    label: string,
    change: number,
    weight: number,
    detail: string,
  ): TradeFactor => ({ label, change, contribution: change * weight, detail });
  result.factors = [
    factor(
      "Player ability",
      abilityChange,
      1,
      `${signed(abilityChange)} average best-position ability; sorted talent floors protect stars and package balance.`,
    ),
    factor(
      "Rotation fit",
      fitChange,
      club.direction === "contend" ? 2.8 : 2.3,
      `${signed(fitChange)} team rating after assigning incoming players to the outgoing vacant slots.`,
    ),
    factor(
      "Coaching scheme",
      schemeChange,
      0.18,
      `${signed(schemeChange)} skill match for ${TACTIC_LABELS[partner.tactic]} and ${DEFENSE_LABELS[partner.defense]}.`,
    ),
    factor(
      "Positional depth",
      depthChange,
      club.direction === "develop" ? 0.8 : 0.6,
      `${signed(depthChange)} coverage across the best two options at each of five positions.`,
    ),
    factor(
      "Roster needs",
      needs.delta,
      0.35,
      `${signed(needs.delta)} improvement in this club's weakest areas: ${needs.names.join(" and ")}.`,
    ),
    factor(
      "Development trend",
      trend,
      club.direction === "develop" ? 0.4 : 0.15,
      `${signed(trend)} recent development advantage; ${club.title.toLowerCase()} clubs weight this at ${club.direction === "develop" ? "40" : "15"}%.`,
    ),
    factor(
      "Continuity",
      continuity,
      1,
      champion
        ? `The defending champion pays a continuity cost for moving ${established} returning player(s).`
        : club.direction === "contend"
          ? "A contender places a modest premium on keeping its established rotation."
          : "This club can reshape its rotation without a continuity penalty.",
    ),
  ];
  const partnerStrategy = strategy(franchise, partner, ctx),
    sourceStrategy = strategy(franchise, source, ctx);
  if (sourceStrategy.active)
    result.userRivalGain = sourceStrategy.tradeChange(
      give,
      receive,
      partner.id,
    );
  if (partnerStrategy.active) {
    result.rivalGain = partnerStrategy.tradeChange(receive, give, source.id);
    result.factors.push(
      factor(
        "Rival coverage",
        result.rivalGain,
        1,
        `${signed(result.rivalGain)} coverage change after this trade. ${partnerStrategy.explanation}`,
      ),
    );
  }
  result.score = result.factors.reduce((sum, f) => sum + f.contribution, 0);
  const prices = { available: 0, listening: 0.65, core: 1.8 };
  result.threshold =
    -1.6 +
    average(
      receive.map((id) => prices[availability(franchise, partner, id, ctx)]),
    ) +
    (club.direction === "contend"
      ? 0.55
      : club.direction === "develop"
        ? -0.15
        : 0);
  if (!talentFloor(give, receive, ctx))
    return reject(
      `${partner.name} declines: the incoming talent falls below its package ability floor.`,
    );
  if (fitChange < (club.direction === "develop" ? -1.8 : -1.25))
    return reject(
      `${partner.name} declines: too much rotation strength would be lost.`,
    );
  if (result.score < result.threshold)
    return reject(
      `${partner.name} declines: value ${result.score.toFixed(2)} falls short of its ${result.threshold.toFixed(2)} asking price (${club.title.toLowerCase()}).`,
    );
  return {
    ...result,
    accepted: true,
    reason: `${partner.name} accepts: package value ${result.score.toFixed(2)} meets its ${result.threshold.toFixed(2)} asking price. ${club.reason}`,
  };
}

function combinations(ids: number[], size: number): number[][] {
  if (size === 0) return [[]];
  return ids.flatMap((id, index) =>
    combinations(ids.slice(index + 1), size - 1).map((rest) => [id, ...rest]),
  );
}
interface Candidate {
  from: number;
  offer: TradePackage;
  potential: number;
}
function candidateKey(candidate: Candidate) {
  return `${candidate.from}:${candidate.offer.teamId}:${candidate.offer.giveIds.join(",")}:${candidate.offer.receiveIds.join(",")}`;
}
const compareCandidates = (a: Candidate, b: Candidate) =>
  b.potential - a.potential || candidateKey(a).localeCompare(candidateKey(b));
function fitPotential(
  team: LeagueTeam,
  outgoing: number[],
  incoming: number[],
  ctx: Context,
): number {
  const slots = ROSTER_SLOTS.filter((slot) =>
    outgoing.includes(team.roster[slot]!),
  );
  // An inexpensive upper bound shortlists packages; only the full evaluator accepts.
  return average(
    slots.map((slot) => {
      const index = POSITIONS.indexOf(slot as Position);
      const fit = (id: number) =>
        index >= 0
          ? ctx.players.get(id)!.fits[index]
          : ctx.players.get(id)!.best;
      return Math.max(...incoming.map(fit)) - fit(team.roster[slot]!);
    }),
  );
}
function candidates(
  franchise: Franchise,
  source: LeagueTeam,
  partner: LeagueTeam,
  size: number,
  ctx: Context,
  maximum: number,
  fixed?: number[],
  target?: number,
  mutual = false,
): Candidate[] {
  const outgoing = fixed
    ? [sorted(fixed)]
    : combinations(sorted(rosterIds(source)), size);
  const incoming = combinations(sorted(rosterIds(partner)), size).filter(
    (ids) => target === undefined || ids.includes(target),
  );
  const best: Candidate[] = [];
  const sourceStrategy = strategy(franchise, source, ctx),
    partnerStrategy = strategy(franchise, partner, ctx);
  // Cheap individual differences guide the shortlist; final negotiations check
  // whole-roster coverage, diminishing returns, and departing rival threats.
  const strategicPotential = (
    plan: RivalStrategy,
    out: number[],
    incoming: number[],
  ) =>
    plan.active
      ? Math.max(
          -3,
          Math.min(
            3,
            average(incoming.map((id) => plan.playerValue(id))) -
              average(out.map((id) => plan.playerValue(id))),
          ),
        )
      : 0;
  for (const giveIds of outgoing)
    for (const receiveIds of incoming) {
      if (
        !talentFloor(giveIds, receiveIds, ctx) ||
        (mutual && !talentFloor(receiveIds, giveIds, ctx))
      )
        continue;
      const ability =
        average(receiveIds.map((id) => ctx.players.get(id)!.best)) -
        average(giveIds.map((id) => ctx.players.get(id)!.best));
      const aFit = fitPotential(source, giveIds, receiveIds, ctx),
        bFit = fitPotential(partner, receiveIds, giveIds, ctx);
      const potential =
        (mutual
          ? aFit + bFit - Math.abs(ability) * 0.8
          : aFit * 1.2 + bFit * 0.7 + ability * 0.3) +
        strategicPotential(sourceStrategy, giveIds, receiveIds) +
        strategicPotential(partnerStrategy, receiveIds, giveIds);
      const candidate = {
        from: source.id,
        offer: { teamId: partner.id, giveIds, receiveIds },
        potential,
      };
      if (
        best.length < maximum ||
        compareCandidates(candidate, best.at(-1)!) < 0
      ) {
        best.push(candidate);
        best.sort(compareCandidates);
        if (best.length > maximum) best.pop();
      }
    }
  return best;
}
export function suggestTrades(
  franchise: Franchise,
  options: SuggestionOptions = {},
): TradeSuggestion[] {
  const limit = Math.min(20, Math.max(0, Math.floor(options.limit ?? 6)));
  if (!limit || franchise.phase !== "offseason" || draftInProgress(franchise))
    return [];
  const ctx = context(franchise),
    source = franchise.teams[0];
  if (!ctx.valid) return [];
  const size = options.packageSize ?? options.giveIds?.length ?? 1;
  if (
    ![1, 2, 3].includes(size) ||
    (options.giveIds &&
      (options.giveIds.length !== size ||
        new Set(options.giveIds).size !== size ||
        !options.giveIds.every((id) => rosterIds(source).includes(id))))
  )
    return [];
  const shortlist = franchise.teams
    .filter(
      (team) =>
        team.id !== 0 &&
        (options.teamId === undefined || team.id === options.teamId) &&
        (options.targetId === undefined ||
          rosterIds(team).includes(options.targetId)),
    )
    .flatMap((partner) =>
      candidates(
        franchise,
        source,
        partner,
        size,
        ctx,
        12,
        options.giveIds,
        options.targetId,
      ),
    );
  const suggestions: TradeSuggestion[] = [];
  for (const candidate of shortlist) {
    const evaluation = evaluateTradePackage(franchise, candidate.offer);
    if (evaluation.accepted)
      suggestions.push({
        offer: candidate.offer,
        evaluation,
        rank:
          evaluation.userDelta +
          0.25 * (evaluation.userRivalGain ?? 0) +
          (0.1 * (evaluation.incomingValue - evaluation.outgoingValue)) / size,
      });
  }
  return suggestions
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        a.offer.teamId - b.offer.teamId ||
        a.offer.giveIds.join(",").localeCompare(b.offer.giveIds.join(",")) ||
        a.offer.receiveIds
          .join(",")
          .localeCompare(b.offer.receiveIds.join(",")),
    )
    .slice(0, limit);
}
export function cpuMarketTrades(
  franchise: Franchise,
  limit = 6,
): { teams: LeagueTeam[]; trades: FranchiseTrade[] } {
  const maximum = Math.min(
      6,
      Math.max(0, Math.floor(limit)),
      FRANCHISE_MAX_TRADES - franchise.trades.length,
    ),
    ctx = context(franchise);
  if (
    !maximum ||
    !ctx.valid ||
    franchise.phase !== "offseason" ||
    draftInProgress(franchise)
  )
    return { teams: franchise.teams, trades: [] };
  const shortlist: Candidate[] = [];
  for (let first = 1; first < franchise.teams.length; first++)
    for (let second = first + 1; second < franchise.teams.length; second++) {
      for (const size of [1, 2])
        shortlist.push(
          ...candidates(
            franchise,
            franchise.teams[first],
            franchise.teams[second],
            size,
            ctx,
            1,
            undefined,
            undefined,
            true,
          ),
        );
    }
  shortlist.sort(compareCandidates);
  const trades: FranchiseTrade[] = [],
    used = new Set<number>();
  let teams = franchise.teams;
  // Bounded full negotiations keep offseason processing responsive. Shortlists
  // contain one- and two-player offers; the evaluator also supports threes.
  for (const candidate of shortlist.slice(0, 180)) {
    if (trades.length >= maximum) break;
    const { from, offer } = candidate;
    if (used.has(from) || used.has(offer.teamId)) continue;
    const live =
      teams === franchise.teams ? franchise : { ...franchise, teams };
    const partner = evaluateTradePackage(live, offer, from);
    if (!partner.accepted) continue;
    const source = evaluateTradePackage(
      live,
      { teamId: from, giveIds: offer.receiveIds, receiveIds: offer.giveIds },
      offer.teamId,
    );
    const sourceBenefit =
      partner.userDelta + 0.25 * (partner.userRivalGain ?? 0);
    const partnerBenefit =
      source.userDelta + 0.25 * (source.userRivalGain ?? 0);
    if (
      !source.accepted ||
      sourceBenefit < 0.03 ||
      partnerBenefit < 0.03 ||
      sourceBenefit + partnerBenefit < 0.15
    )
      continue;
    teams = exchangePackage(
      teams,
      from,
      offer.teamId,
      offer.giveIds,
      offer.receiveIds,
    );
    used.add(from);
    used.add(offer.teamId);
    trades.push({
      year: franchise.year,
      fromTeamId: from,
      teamId: offer.teamId,
      giveId: offer.giveIds[0],
      receiveId: offer.receiveIds[0],
      packageVersion: 1,
      giveIds: [...offer.giveIds],
      receiveIds: [...offer.receiveIds],
      source: "cpu",
      reason: `Both coaches accept a ${offer.giveIds.length}-player package: ${franchise.teams[from].name} ${signed(partner.userDelta)} rotation rating, ${franchise.teams[offer.teamId].name} ${signed(source.userDelta)}. ${partner.profile.title} and ${source.profile.title.toLowerCase()} priorities both met.${source.userRivalGain !== undefined || partner.userRivalGain !== undefined ? ` Rival coverage: ${signed(partner.userRivalGain ?? 0)} / ${signed(source.userRivalGain ?? 0)}. ${strategy(live, live.teams[from]).explanation} ${strategy(live, live.teams[offer.teamId]).explanation}` : ""}`,
    });
  }
  return { teams, trades };
}
