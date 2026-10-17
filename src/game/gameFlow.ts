import { POKEMON_BY_ID } from "../data/pokemon";
import { speciesAbility } from "./abilities";
import { moraleProfile } from "./playerMorale";
import { playerProfile, type PlayerProfile } from "./playerProfile";
import type { TrainerCoach } from "./trainerCoaches";
import type { OpponentScouting } from "./typeTacticsTypes";
import {
  ROSTER_SLOTS,
  type DefenseScheme,
  type LeagueFixture,
  type LeagueTeam,
  type Tactic,
} from "./types";

/** Frozen per-fixture context. Stored on fixtures and summaries like other snapshots. */
export interface GameFlowFixture {
  stage: "regular" | "playoff";
  /** Days off before the game (0 = back-to-back), capped at 3. */
  rest: { home: number; away: number };
  /** Consecutive road games including this one (0 at home), capped at 6. */
  trip: { home: number; away: number };
  playoff?: {
    round: number;
    /** One-based game number within the series. */
    game: number;
    homeWins: number;
    awayWins: number;
    winsNeeded: number;
    /** The previous game of this series, when one exists. */
    previous?: { winnerId: number; margin: number };
  };
}
export type FieldCondition =
  | "neutral"
  | "rain"
  | "sun"
  | "sand"
  | "snow"
  | "electric"
  | "grassy"
  | "misty"
  | "psychic";
export type CrewId = "letThemPlay" | "loose" | "standard" | "tight" | "whistle";
export interface RefereeCrew {
  id: CrewId;
  label: string;
  tightness: number;
}
export type TimeoutReason = "run" | "rest" | "late";
export interface TimeoutEvent {
  teamId: number;
  period: number;
  elapsedSeconds: number;
  reason: TimeoutReason;
  /** Average floor energy when the timeout was called. */
  energy: number;
  /** Score margin from the calling team's perspective. */
  margin: number;
  /** Unanswered opponent points at the time of the call. */
  run: number;
}
export interface GameFlowReport {
  version: 1;
  stage: GameFlowFixture["stage"];
  playoff?: GameFlowFixture["playoff"];
  rest: GameFlowFixture["rest"];
  trip: GameFlowFixture["trip"];
  elimination: { home: boolean; away: boolean };
  referee: RefereeCrew;
  arena: { teamId: number; condition: FieldCondition };
  /** Possessions played under a setter's condition instead of the arena's. */
  setterPossessions: number;
  loadManaged: { home: boolean; away: boolean };
  timeouts: TimeoutEvent[];
  notes: string[];
  /** Court rules v2 only: when players heated up or went cold. */
  heat?: {
    playerId: string;
    period: number;
    elapsedSeconds: number;
    state: "hot" | "cold";
  }[];
  /** Court rules v2 only: field-goal attempts taken while hot. */
  hotShots?: { playerId: string; attempts: number; made: number }[];
}

export const FIELD_LABELS: Record<FieldCondition, string> = {
  neutral: "Neutral court",
  rain: "Rain",
  sun: "Harsh sun",
  sand: "Sandstorm",
  snow: "Snow",
  electric: "Electric terrain",
  grassy: "Grassy terrain",
  misty: "Misty terrain",
  psychic: "Psychic terrain",
};

const SALT_DAY = 0x3c6ef372,
  SALT_CREW = 0x7f4a7c15;
/** Salted integer hash in [0, 1). Never reads or advances a simulation stream. */
export function flowHash(value: number, salt: number): number {
  let h = (value ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0x100000000;
}

/** Round r spans days 2r and 2r+1; about 22% of fixtures use the second day. */
export function gameDay(fixture: Pick<LeagueFixture, "round" | "seed">) {
  return fixture.round * 2 + (flowHash(fixture.seed, SALT_DAY) < 0.22 ? 1 : 0);
}

/** Regular-season context for every fixture, in schedule order. */
export function scheduleFlow(
  fixtures: readonly LeagueFixture[],
): Map<string, GameFlowFixture> {
  const lastDay = new Map<number, number>(),
    road = new Map<number, number>(),
    flows = new Map<string, GameFlowFixture>();
  for (const fixture of fixtures) {
    const day = gameDay(fixture);
    const rest = (id: number) =>
      lastDay.has(id) ? Math.max(0, Math.min(3, day - lastDay.get(id)! - 1)) : 3;
    const awayTrip = Math.min(6, (road.get(fixture.awayTeamId) ?? 0) + 1);
    flows.set(fixture.id, {
      stage: "regular",
      rest: { home: rest(fixture.homeTeamId), away: rest(fixture.awayTeamId) },
      trip: { home: 0, away: awayTrip },
    });
    lastDay.set(fixture.homeTeamId, day);
    lastDay.set(fixture.awayTeamId, day);
    road.set(fixture.homeTeamId, 0);
    road.set(fixture.awayTeamId, awayTrip);
  }
  return flows;
}

/** Playoff context from series state before the game is played. */
export function playoffFlow(
  series: {
    round: number;
    higherSeedId: number | null;
    higherSeedWins: number;
    lowerSeedWins: number;
    games: { homeTeamId: number; homeScore: number; awayScore: number; awayTeamId: number }[];
  },
  homeTeamId: number,
  bestOf: number,
): GameFlowFixture {
  const higherHome = homeTeamId === series.higherSeedId;
  const last = series.games.at(-1);
  return {
    stage: "playoff",
    rest: series.games.length ? { home: 1, away: 1 } : { home: 2, away: 2 },
    trip: { home: 0, away: 1 },
    playoff: {
      round: series.round,
      game: series.games.length + 1,
      homeWins: higherHome ? series.higherSeedWins : series.lowerSeedWins,
      awayWins: higherHome ? series.lowerSeedWins : series.higherSeedWins,
      winsNeeded: Math.ceil(bestOf / 2),
      ...(last
        ? {
            previous: {
              winnerId:
                last.homeScore > last.awayScore
                  ? last.homeTeamId
                  : last.awayTeamId,
              margin: Math.abs(last.homeScore - last.awayScore),
            },
          }
        : {}),
    },
  };
}

export function validateGameFlowFixture(value: unknown): GameFlowFixture {
  const v = value as GameFlowFixture;
  const days = (n: unknown, max: number) =>
    Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;
  if (
    !v ||
    typeof v !== "object" ||
    (v.stage !== "regular" && v.stage !== "playoff") ||
    !days(v.rest?.home, 3) ||
    !days(v.rest?.away, 3) ||
    !days(v.trip?.home, 6) ||
    !days(v.trip?.away, 6) ||
    (v.stage === "regular") !== (v.playoff === undefined)
  )
    throw new Error("Invalid game flow context.");
  if (v.playoff) {
    const p = v.playoff;
    if (
      !days(p.round, 3) ||
      !Number.isInteger(p.game) ||
      p.game < 1 ||
      p.game > 7 ||
      !days(p.winsNeeded, 4) ||
      p.winsNeeded < 1 ||
      !days(p.homeWins, p.winsNeeded - 1) ||
      !days(p.awayWins, p.winsNeeded - 1) ||
      p.homeWins + p.awayWins !== p.game - 1 ||
      (p.previous !== undefined &&
        (!Number.isInteger(p.previous.winnerId) ||
          !Number.isInteger(p.previous.margin) ||
          p.previous.margin < 1)) ||
      (p.game > 1) !== (p.previous !== undefined)
    )
      throw new Error("Invalid playoff game flow context.");
  }
  return structuredClone(v);
}

export const NEUTRAL_FLOW: GameFlowFixture = {
  stage: "regular",
  rest: { home: 2, away: 2 },
  trip: { home: 0, away: 1 },
};

export function eliminationGame(flow: GameFlowFixture) {
  const p = flow.playoff;
  return {
    home: !!p && p.awayWins === p.winsNeeded - 1,
    away: !!p && p.homeWins === p.winsNeeded - 1,
  };
}

const CREWS: RefereeCrew[] = [
  { id: "letThemPlay", label: "Let them play", tightness: -1 },
  { id: "loose", label: "Loose whistle", tightness: -0.5 },
  { id: "standard", label: "Standard crew", tightness: 0 },
  { id: "tight", label: "Tight whistle", tightness: 0.5 },
  { id: "whistle", label: "Whistle-happy", tightness: 1 },
];
/** 12/20/36/20/12 crew mix; playoff crews let more contact go by half a step. */
export function refereeCrew(seed: number, stage: GameFlowFixture["stage"]) {
  const roll = flowHash(seed, SALT_CREW);
  let index = roll < 0.12 ? 0 : roll < 0.32 ? 1 : roll < 0.68 ? 2 : roll < 0.88 ? 3 : 4;
  if (stage === "playoff") index = Math.max(0, index - 1);
  return CREWS[index];
}

/** Arena identity by club ID; club 0 follows its own roster. */
const ARENAS: Record<number, FieldCondition> = {
  2: "grassy", // Viridian Vipers
  3: "sand", // Pewter Titans
  4: "rain", // Cerulean Waves
  5: "electric", // Vermilion Bolts
  7: "grassy", // Celadon Bloom
  9: "psychic", // Saffron Mystics
  10: "sun", // Cinnabar Flames
  12: "electric", // New Bark Sparks
  19: "rain", // Cianwood Breakers
  20: "snow", // Mahogany Frost
  22: "grassy", // Littleroot Leaves
  24: "sand", // Rustboro Rock
  25: "rain", // Dewford Tide
  27: "electric", // Mauville Charge
  29: "misty", // Lilycove Pearls
};
const TYPE_FIELD: Record<string, FieldCondition> = {
  water: "rain",
  fire: "sun",
  rock: "sand",
  ground: "sand",
  ice: "snow",
  electric: "electric",
  grass: "grassy",
  fairy: "misty",
  psychic: "psychic",
};
const FIELD_ORDER: FieldCondition[] = [
  "rain",
  "sun",
  "sand",
  "snow",
  "electric",
  "grassy",
  "misty",
  "psychic",
];
export function arenaCondition(team: Pick<LeagueTeam, "id" | "roster">): FieldCondition {
  if (team.id !== 0) return ARENAS[team.id] ?? "neutral";
  const counts = new Map<FieldCondition, number>();
  for (const slot of ROSTER_SLOTS) {
    const mon = POKEMON_BY_ID.get(team.roster[slot]!);
    const fields = new Set(
      (mon?.types ?? []).flatMap((t) => (TYPE_FIELD[t] ? [TYPE_FIELD[t]] : [])),
    );
    for (const field of fields) counts.set(field, (counts.get(field) ?? 0) + 1);
  }
  let best: FieldCondition = "neutral",
    most = 2;
  for (const field of FIELD_ORDER)
    if ((counts.get(field) ?? 0) > most) {
      best = field;
      most = counts.get(field)!;
    }
  return best;
}

const SETTERS: Record<string, FieldCondition> = {
  drizzle: "rain",
  drought: "sun",
  "orichalcum-pulse": "sun",
  "sand-stream": "sand",
  "snow-warning": "snow",
  "electric-surge": "electric",
  "hadron-engine": "electric",
  "grassy-surge": "grassy",
  "misty-surge": "misty",
  "psychic-surge": "psychic",
};
export function setterCondition(pokemonId: number): FieldCondition | undefined {
  return SETTERS[speciesAbility(pokemonId).id];
}
/** The floor's condition: a home setter, then an away setter, then the arena. */
export function floorCondition(
  arena: FieldCondition,
  homeFloor: readonly number[],
  awayFloor: readonly number[],
): FieldCondition {
  for (const floor of [homeFloor, awayFloor])
    for (const id of floor) {
      const set = setterCondition(id);
      if (set) return set;
    }
  return arena;
}

type WeatherGroup = "speed" | "endurance" | "evasion" | "craft" | "focus";
const WEATHER_ABILITIES: Record<string, [WeatherGroup, FieldCondition]> = {
  "swift-swim": ["speed", "rain"],
  chlorophyll: ["speed", "sun"],
  "sand-rush": ["speed", "sand"],
  "slush-rush": ["speed", "snow"],
  "surge-surfer": ["speed", "electric"],
  protosynthesis: ["speed", "sun"],
  "quark-drive": ["speed", "electric"],
  "orichalcum-pulse": ["speed", "sun"],
  "hadron-engine": ["speed", "electric"],
  hydration: ["endurance", "rain"],
  "dry-skin": ["endurance", "rain"],
  "rain-dish": ["endurance", "rain"],
  "ice-body": ["endurance", "snow"],
  "sand-veil": ["evasion", "sand"],
  "snow-cloak": ["evasion", "snow"],
  "sand-force": ["craft", "sand"],
  "leaf-guard": ["focus", "sun"],
};
function weatherGroup(pokemonId: number, condition: FieldCondition) {
  const entry = WEATHER_ABILITIES[speciesAbility(pokemonId).id];
  return entry && entry[1] === condition ? entry[0] : undefined;
}
export function isWeatherAbility(pokemonId: number) {
  return WEATHER_ABILITIES[speciesAbility(pokemonId).id] !== undefined;
}

/** Extra shot probability from a matching condition, on top of the normal ability effect. */
export function fieldAbilityBonus(
  pokemonId: number,
  role: "shooter" | "passer" | "defender",
  context: {
    zone: "rim" | "mid" | "three";
    play: string;
    contested: boolean;
    energy: number;
  },
  condition: FieldCondition,
): number {
  const group = weatherGroup(pokemonId, condition);
  if (!group) return 0;
  if (role === "shooter") {
    if (group === "speed" && context.play === "transition") return 0.01;
    if (group === "craft" && context.zone === "mid") return 0.01;
    if (group === "focus" && context.contested && context.zone !== "rim")
      return 0.01;
  }
  if (
    role === "defender" &&
    group === "evasion" &&
    context.contested &&
    context.energy > 55
  )
    return -0.01;
  return 0;
}

const COMFORT: Record<FieldCondition, string[]> = {
  neutral: [],
  rain: ["water"],
  sun: ["fire", "grass"],
  sand: ["rock", "ground", "steel"],
  snow: ["ice"],
  electric: ["electric"],
  grassy: ["grass"],
  misty: ["fairy"],
  psychic: ["psychic"],
};
const DISCOMFORT: Record<FieldCondition, string[]> = {
  neutral: [],
  rain: ["fire"],
  sun: ["water", "ice"],
  sand: [],
  snow: [],
  electric: [],
  grassy: [],
  misty: ["dragon"],
  psychic: [],
};
/** Movement and drain multipliers for one player under a condition. */
export function fieldEffects(
  pokemonId: number,
  types: readonly string[],
  condition: FieldCondition,
  physicalAbilities: boolean,
): { movement: number; drain: number } {
  let drain = 1,
    movement = 1;
  if (types.some((t) => COMFORT[condition].includes(t))) drain *= 0.95;
  else if (types.some((t) => DISCOMFORT[condition].includes(t))) drain *= 1.04;
  const group = physicalAbilities ? weatherGroup(pokemonId, condition) : undefined;
  // Physical ability multipliers are 1.08 movement and 0.82 drain; matching weather
  // lifts them to 1.12 and 0.75 without changing the base profile.
  if (group === "speed") movement *= 1.12 / 1.08;
  if (group === "endurance") drain *= 0.75 / 0.82;
  return { movement, drain };
}

/** Integer minute targets that keep the exact 240-minute budget. */
function allocate(raw: number[], cap: number): number[] {
  const capped = raw.map((v) => Math.max(0, Math.min(cap, v)));
  const floors = capped.map(Math.floor);
  let remaining = 240 - floors.reduce((a, b) => a + b, 0);
  const order = capped
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remaining > 0 && k < order.length * 4; k++) {
    const { i } = order[k % order.length];
    if (floors[i] < cap) {
      floors[i]++;
      remaining--;
    }
  }
  for (let k = 0; remaining < 0 && k < order.length * 4; k++) {
    const { i } = order[order.length - 1 - (k % order.length)];
    if (floors[i] > 0) {
      floors[i]--;
      remaining++;
    }
  }
  return floors;
}
function ranked(targets: readonly number[]) {
  return targets
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map((v) => v.i);
}
/** Playoff rotations move minutes from the end of the bench to the core. */
export function playoffTargets(
  targets: readonly number[],
  restPreference: number,
  elimination: boolean,
): number[] {
  const order = ranked(targets);
  const k = (1 - 0.5 * restPreference) * (elimination ? 1.3 : 1);
  const next = [...targets];
  let freed = 0;
  for (const [rank, share] of [
    [7, 0.4],
    [6, 0.12],
  ] as const) {
    const i = order[rank];
    const cut = Math.min(next[i], next[i] * share * k);
    next[i] -= cut;
    freed += cut;
  }
  const core = order.slice(0, 5);
  for (let pass = 0; pass < 3 && freed > 1e-9; pass++) {
    const open = core.filter((i) => next[i] < 42);
    const weight = open.reduce((n, i) => n + next[i], 0);
    if (!weight) break;
    let given = 0;
    for (const i of open) {
      const add = Math.min(42 - next[i], (freed * next[i]) / weight);
      next[i] += add;
      given += add;
    }
    freed -= given;
  }
  return allocate(next, 42);
}
/** Load management on a back-to-back: starters give minutes to the bench. */
export function restTargets(
  targets: readonly number[],
  restPreference: number,
): number[] {
  const order = ranked(targets);
  const next = [...targets];
  let freed = 0;
  for (const i of order.slice(0, 5)) {
    const cut = Math.min(next[i], 4 * restPreference);
    next[i] -= cut;
    freed += cut;
  }
  const bench = order.slice(5);
  const weight = bench.reduce((n, i) => n + next[i] + 4, 0);
  for (const i of bench) next[i] += (freed * (next[i] + 4)) / weight;
  return allocate(next, 40);
}

/** Starting energy below 100 after a back-to-back or a long road trip. */
export function startingEnergy(
  target: number,
  stamina: number,
  rest: number,
  trip: number,
) {
  const tired =
    rest === 0 ? (2.5 + (5 * target) / 36) * (1.25 - stamina / 200) : 0;
  const travel = Math.min(1.5, Math.max(0, trip - 3) * 0.5);
  return Math.max(80, 100 - tired - travel);
}

export interface TimeoutState {
  period: number;
  remaining: number;
  /** Seconds until the next substitution window. */
  untilWindow: number;
  margin: number;
  run: number;
  energy: number;
  left: number;
  fourthUsed: number;
  restUsedThisPeriod: boolean;
  lateUsedThisPeriod: boolean;
}
/** Deterministic coach decision for the team about to gain possession. */
export function timeoutDecision(
  coach: Pick<TrainerCoach, "adaptability" | "rest">,
  s: TimeoutState,
): TimeoutReason | undefined {
  if (s.left <= 0) return undefined;
  const fourth = s.period === 3;
  if (fourth && s.fourthUsed >= 3) return undefined;
  const finalStretch = s.period >= 3 && s.remaining <= 180;
  if (
    s.period >= 3 &&
    s.remaining <= 24 &&
    s.margin <= 0 &&
    s.margin >= -3 &&
    !s.lateUsedThisPeriod
  )
    return "late";
  // Keep two timeouts for the final three minutes until they arrive.
  if (s.left <= (finalStretch ? 0 : 2)) return undefined;
  if (s.run >= Math.round(10 - 4 * coach.adaptability)) return "run";
  if (
    !finalStretch &&
    !s.restUsedThisPeriod &&
    s.untilWindow > 20 &&
    s.energy < 56 + 10 * coach.rest
  )
    return "rest";
  return undefined;
}

/** The roster's best-fitting tactic other than the current one, by the coach fit formula. */
export function alternateTactic(
  team: LeagueTeam,
  current: Tactic,
): Tactic | undefined {
  const profiles = ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot]!);
    return mon
      ? [moraleProfile(playerProfile(mon, team.development?.[mon.id]), team, mon.id)]
      : [];
  });
  if (!profiles.length) return undefined;
  const avg = (key: keyof PlayerProfile["attributes"]) =>
    profiles.reduce((n, p) => n + p.attributes[key], 0) / profiles.length;
  const fit: Record<Tactic, number> = {
    balanced: (avg("passing") + avg("composure")) / 2,
    pace: (avg("speed") + avg("stamina") + avg("ballHandling")) / 3,
    perimeter: (avg("threePoint") * 2 + avg("passing")) / 3,
    interior: (avg("finishing") + avg("strength") + avg("rebounding")) / 3,
    defense: (avg("perimeterDefense") + avg("interiorDefense")) / 2,
  };
  return (Object.keys(fit) as Tactic[])
    .filter((t) => t !== current)
    .sort((a, b) => fit[b] - fit[a])[0];
}

/** A trailing coach re-plans from the series' scouting evidence. */
export function seriesAdjustment(
  plan: { tactic: Tactic; defense: DefenseScheme },
  coach: Pick<TrainerCoach, "adaptability">,
  teamId: number,
  flow: GameFlowFixture,
  history: OpponentScouting | undefined,
  alternate: () => Tactic | undefined,
): { tactic: Tactic; defense: DefenseScheme; note?: string } {
  const previous = flow.playoff?.previous;
  if (!previous || previous.winnerId === teamId || coach.adaptability < 0.5)
    return plan;
  let { tactic, defense } = plan;
  const notes: string[] = [];
  if (history) {
    const shots = Object.values(history.players);
    const attempts = shots.reduce((n, p) => n + p.attempts, 0);
    if (attempts >= 20) {
      const threes = shots.reduce((n, p) => n + p.threeAttempts, 0) / attempts,
        rim = shots.reduce((n, p) => n + p.rimAttempts, 0) / attempts;
      const next: DefenseScheme =
        threes >= 0.4 ? "switch" : rim >= 0.45 ? "zone" : defense;
      if (next !== defense) {
        notes.push(
          `Lost the last game: ${next === "switch" ? "switch to stay attached to shooters" : "zone to protect the paint"} (${Math.round((next === "switch" ? threes : rim) * 100)}% of scouted attempts).`,
        );
        defense = next;
      }
    }
  }
  const next = previous.margin >= 15 ? alternate() : undefined;
  if (next && next !== tactic) {
    notes.push(`Lost by ${previous.margin}: try ${next} instead of ${tactic}.`);
    tactic = next;
  }
  return notes.length ? { tactic, defense, note: notes.join(" ") } : plan;
}
