import {
  applyMasterySnapshot,
  masteryGameReport,
  masteryXp,
  validateMasteryRoster,
  type MasteryFixture,
} from "./abilityMastery";
import {
  applyMoraleSnapshot,
  moraleGameReport,
  moraleProfile,
  validateMoraleRoster,
  type MoraleFixture,
} from "./playerMorale";
import {
  addSharedMinutes,
  finishPairMinutes,
  applyChemistrySnapshot,
  type ChemistryFixture,
} from "./teammateChemistry";
import { chemistryEnabled } from "./lineupChemistry";
import { getMatchChemistry, refreshLineupChemistry } from "./matchChemistry";
import {
  physicalAbilitiesEnabled,
  physicalPlayerEffects,
  abilityEnergyChange,
} from "./physicalAbilities";
import {
  abilitiesEnabled,
  recordPhysicalAbility,
  abilityImpact,
  addAbilityActivation,
  emptyAbilityActivations,
  speciesAbility,
  type AbilityRole,
} from "./abilities";
import {
  coachGamePlan,
  coachRotationMinutes,
  coachAdjustment,
} from "./coachPolicy";
import { getCoach, validateCoach } from "./trainerCoaches";
import { resolveCourtPossession } from "./courtPossession";
import { isCourtVersion, type CourtSequence } from "./courtTypes";
import {
  bodyProfile,
  matchupEdges,
  matchupPreference,
  preferenceFromEdges,
  resolveBodyMatchup,
  screenLeverage,
  type MatchupEvidence,
} from "./bodyMatchups";
import { resolveRebound, creationChance } from "./possessionModel";
import { emptyPossessionPlayer, emptyPossessionTeam } from "./possessionTypes";
import {
  assignTypeDefenders,
  chooseTypeHelp,
  scoutedThreat,
  scoutedCoverage,
  screenCoverage,
  shouldSwitchScreen,
} from "./typeTactics";
import { scoutingForMatch, validateMatchScouting } from "./opponentScouting";
import type { MatchScouting, TypeTacticsSummary } from "./typeTacticsTypes";
import {
  chooseLineup,
  replaceFoulOut,
  type Player,
  type Team,
} from "./matchLineups";
import { POKEMON_BY_ID } from "../data/pokemon";
import { clamp, rotationMinutes } from "./ratings";
import { nextRandom } from "./random";
import { DEVELOPMENT_SKILLS } from "./developmentTypes";
import { playerProfile } from "./playerProfile";
import { evaluateShot } from "./shotModel";
import { engineProfile, lineupChemistry, signatureImpact } from "./engineDepth";
import type {
  DefenseSummary,
  LineupSummary,
  ShotEvent,
} from "./engineInsightsTypes";
import {
  applyTypeShotEffect,
  typeMatchup,
  typeShotLogOdds,
} from "./typeMatchups";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type Attributes,
  type DefenseScheme,
  type LeagueBox,
  type LeagueMatch,
  type LeagueTeam,
  type PlayType,
} from "./types";

type Side = "home" | "away";
type Zone = "rim" | "mid" | "three";

const PLAY_TYPES: PlayType[] = [
  "transition",
  "pickRoll",
  "isolation",
  "post",
  "spotUp",
];
const ROLE_ORDER = [0, 4, 1, 3, 2];
const baseShotMix: Record<PlayType, number[]> = {
  transition: [67, 5, 28],
  pickRoll: [53, 20, 27],
  isolation: [41, 32, 27],
  post: [77, 19, 4],
  spotUp: [18, 12, 70],
};
/** Share of the carrier-pressure turnover rate applied on top of version-2 court risks. */
const COURT_PRESSURE_SHARE = 0.4;
/** Version 3: shot accuracy shifts 0.25 points per point of lead, at most 3.5. */
const SCORE_STATE_PER_POINT = 0.0025;
const SCORE_STATE_CAP = 0.035;
/** Version 2: a pass that leads straight to the shot is usually an assist. */
function catchAssistChance(
  droveAfterCatch: boolean,
  passing: number,
  disrupted: boolean,
) {
  return clamp(
    (droveAfterCatch ? 0.6 : 0.93) +
      (passing - 60) * 0.003 -
      (disrupted ? 0.18 : 0),
    0.1,
    0.95,
  );
}
const targetCache = new Map<string, ReturnType<typeof rotationMinutes>>();

function buildTeam(config: LeagueTeam, side: Side): Team {
  const ids = ROSTER_SLOTS.map((slot) => config.roster[slot]);
  if (
    new Set(ids).size !== 8 ||
    ids.some((id) => id == null || !POKEMON_BY_ID.has(id))
  ) {
    throw new Error("A match requires eight unique Pokémon in each roster.");
  }
  const offsetsKey = config.development
    ? ids
        .map((id) =>
          DEVELOPMENT_SKILLS.map(
            (skill) => config.development?.[id!]?.[skill] ?? 0,
          ).join(","),
        )
        .join(";")
    : "";
  const planKey = config.rotationPlan
    ? `:${ROSTER_SLOTS.map((slot) => config.rotationPlan!.minutes[slot]).join(",")}:${config.rotationPlan.closing.join(",")}`
    : "";
  const key = `${config.abilityMasteryVersion === 1 ? `mastery1:${JSON.stringify(config.abilityMastery ?? {})}:` : ""}${config.personalityVersion === 1 ? "personality1:" : ""}${config.moraleVersion === 1 ? `morale1:${JSON.stringify(config.morale ?? {})}:` : ""}${config.chemistryGrowthVersion === 1 ? `growth1:${JSON.stringify(config.chemistryBonds ?? {})}:` : ""}${chemistryEnabled(config) ? `chemistry1:${config.engineRules?.familiarity ?? 0}:` : ""}${physicalAbilitiesEnabled(config) ? "physical1:" : ""}${config.evaluationVersion ?? 0}:${config.evaluationVersion === 1 ? `${config.tactic}:${config.defense}:` : ""}${abilitiesEnabled(config) ? "abilities1" : "legacy"}:${config.coach?.id ?? ""}:${ids.join(",")}:${config.rotation}:${offsetsKey}${planKey}`;
  let targets = targetCache.get(key);
  if (!targets) {
    targets =
      config.coach || (config.evaluationVersion === 1 && !config.rotationPlan)
        ? coachRotationMinutes(config)
        : rotationMinutes(
            config.roster,
            config.rotation,
            config.development,
            config.rotationPlan,
          );
    // A bounded cache covers many seasons without retaining every custom roster.
    if (targetCache.size > 240) targetCache.clear();
    targetCache.set(key, targets);
  }
  const players = ROSTER_SLOTS.map((slot, index): Player => {
    const pokemonId = ids[index]!;
    return {
      ...(config.abilityMasteryVersion === 1
        ? { masteryXp: masteryXp(config, pokemonId) }
        : {}),
      ...(physicalAbilitiesEnabled(config)
        ? { physicalAbilities: true as const }
        : {}),
      types: POKEMON_BY_ID.get(pokemonId)!.types,
      body:
        config.matchupVersion === 1
          ? bodyProfile(
              POKEMON_BY_ID.get(pokemonId)!,
              config.courtVersion === 3,
            )
          : undefined,
      typeEdges: new Map(),
      profile: moraleProfile(
        playerProfile(
          POKEMON_BY_ID.get(pokemonId)!,
          config.development?.[pokemonId],
        ),
        config,
        pokemonId,
      ),
      depth: config.engineRules
        ? engineProfile(POKEMON_BY_ID.get(pokemonId)!)
        : undefined,
      target: targets![slot],
      energy: 100,
      consecutive: 0,
      box: {
        ...(abilitiesEnabled(config)
          ? { abilityActivations: emptyAbilityActivations() }
          : {}),
        pokemonId,
        slot,
        teamId: config.id,
        playerId: `${config.id}:${pokemonId}`,
        started: index < 5,
        minutes: 0,
        points: 0,
        offensiveRebounds: 0,
        defensiveRebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fgm: 0,
        fga: 0,
        threePM: 0,
        threePA: 0,
        ftm: 0,
        fta: 0,
        fouls: 0,
        plusMinus: 0,
        rimFgm: 0,
        rimFga: 0,
        midFgm: 0,
        midFga: 0,
      },
    };
  });
  const floor = players.slice(0, 5);
  if (config.rotationPlan) {
    for (const role of ROLE_ORDER) {
      if (floor[role].target > 0) continue;
      const available = players.filter(
        (p) => p.target > 0 && !floor.includes(p),
      );
      available.sort(
        (a, b) =>
          b.profile.positions[POSITIONS[role]] -
          a.profile.positions[POSITIONS[role]],
      );
      floor[role] = available[0];
    }
    for (const player of players) player.box.started = floor.includes(player);
  }
  return {
    config: config.engineRules ? { ...config } : config,
    side,
    players,
    floor,
    fouls: 0,
    transition: 0,
  };
}

const skill = (p: Player, key: keyof Attributes) => {
  const cooperation =
    key === "passing"
      ? (p.chemistry?.passing ?? 1)
      : key === "perimeterDefense" || key === "interiorDefense"
        ? (p.chemistry?.defense ?? 1)
        : 1;
  if (!p.depth || p.body)
    return p.profile.attributes[key] * (0.72 + p.energy * 0.0028) * cooperation;
  const physical = p.depth.physical;
  const addition =
    key === "speed"
      ? physical.agility
      : key === "strength"
        ? physical.postContact
        : key === "offensiveRebound" || key === "defensiveRebound"
          ? physical.rebounding
          : key === "block"
            ? physical.reach * 3
            : 0;
  return (
    clamp(p.profile.attributes[key] + addition, 1, 100) *
    (0.72 + p.energy * 0.0028) *
    cooperation
  );
};
const average = (players: Player[], get: (p: Player) => number) =>
  players.reduce((sum, p) => sum + get(p), 0) / players.length;

/** One seeded, symmetric game. All points are produced by shots and free throws;
 * there is no synthetic opponent score or post-hoc score correction. */
export function simulateMatch(
  home: LeagueTeam,
  away: LeagueTeam,
  seed: number,
  options: {
    collectInsights?: boolean;
    scouting?: MatchScouting;
    chemistry?: ChemistryFixture;
    morale?: MoraleFixture;
    mastery?: MasteryFixture;
  } = {},
): LeagueMatch {
  if (
    home.abilityMasteryVersion !== away.abilityMasteryVersion ||
    (home.abilityMasteryVersion !== undefined &&
      home.abilityMasteryVersion !== 1) ||
    (home.abilityMasteryVersion === 1 &&
      (home.abilityVersion !== 1 || away.abilityVersion !== 1))
  )
    throw new Error(
      "Both teams must use matching ability mastery rules with abilities enabled.",
    );
  if (options.mastery) {
    home = applyMasterySnapshot(home, options.mastery.home);
    away = applyMasterySnapshot(away, options.mastery.away);
  }
  for (const team of [home, away])
    if (team.abilityMasteryVersion === 1 && team.abilityMastery !== undefined)
      validateMasteryRoster(team.abilityMastery, team);
  if (
    home.personalityVersion !== away.personalityVersion ||
    (home.personalityVersion !== undefined && home.personalityVersion !== 1) ||
    (home.personalityVersion === 1 &&
      (home.moraleVersion !== 1 || away.moraleVersion !== 1))
  )
    throw new Error(
      "Both teams must use matching personality rules with morale enabled.",
    );
  if (
    home.moraleVersion !== away.moraleVersion ||
    (home.moraleVersion !== undefined && home.moraleVersion !== 1) ||
    (home.moraleVersion === 1 &&
      (home.chemistryGrowthVersion !== 1 || away.chemistryGrowthVersion !== 1))
  )
    throw new Error(
      "Both teams must use matching morale rules and teammate growth.",
    );
  if (options.morale) {
    home = applyMoraleSnapshot(home, options.morale.home);
    away = applyMoraleSnapshot(away, options.morale.away);
  }
  for (const team of [home, away])
    if (team.moraleVersion === 1 && team.morale !== undefined)
      validateMoraleRoster(team.morale, team);
  if (
    home.chemistryGrowthVersion !== away.chemistryGrowthVersion ||
    (home.chemistryGrowthVersion !== undefined &&
      home.chemistryGrowthVersion !== 1) ||
    (home.chemistryGrowthVersion === 1 &&
      (home.chemistryVersion !== 1 || away.chemistryVersion !== 1))
  )
    throw new Error(
      "Both teams must use matching teammate chemistry growth rules.",
    );
  if (options.chemistry) {
    home = applyChemistrySnapshot(home, options.chemistry.home);
    away = applyChemistrySnapshot(away, options.chemistry.away);
  }
  for (const team of [home, away]) {
    const rules = team.engineRules;
    if (
      rules &&
      (rules.version !== 1 ||
        typeof rules.abilities !== "boolean" ||
        typeof rules.adaptiveCoaching !== "boolean" ||
        !Number.isFinite(rules.familiarity) ||
        rules.familiarity < 0 ||
        rules.familiarity > 1)
    )
      throw new Error("Invalid engine rules or familiarity.");
  }
  if (home.simulationVersion !== away.simulationVersion)
    throw new Error("Both teams must use the same simulation model.");
  if (home.typeMatchupsVersion !== away.typeMatchupsVersion)
    throw new Error("Both teams must use the same type matchup rules.");
  if (
    home.typeTacticsVersion !== away.typeTacticsVersion ||
    (home.typeTacticsVersion !== undefined && home.typeTacticsVersion !== 1) ||
    (home.typeTacticsVersion === 1 && home.typeMatchupsVersion !== 1)
  )
    throw new Error("Both teams must use valid, matching type tactics rules.");
  if (
    home.possessionVersion !== away.possessionVersion ||
    (home.possessionVersion !== undefined && home.possessionVersion !== 1)
  )
    throw new Error("Both teams must use valid, matching possession rules.");
  if (
    home.matchupVersion !== away.matchupVersion ||
    (home.matchupVersion !== undefined && home.matchupVersion !== 1) ||
    (home.matchupVersion === 1 &&
      (home.possessionVersion !== 1 || home.typeTacticsVersion !== 1))
  )
    throw new Error(
      "Both teams must use valid, matching physical matchup rules.",
    );
  if (
    home.courtVersion !== away.courtVersion ||
    (home.courtVersion !== undefined && !isCourtVersion(home.courtVersion))
  )
    throw new Error("Both teams must use valid, matching court rules.");
  if (
    home.abilityVersion !== away.abilityVersion ||
    (home.abilityVersion !== undefined && home.abilityVersion !== 1)
  )
    throw new Error(
      "Both teams must use valid, matching species ability rules.",
    );
  if (
    home.evaluationVersion !== away.evaluationVersion ||
    (home.evaluationVersion !== undefined && home.evaluationVersion !== 1)
  )
    throw new Error(
      "Both teams must use valid, matching team evaluation rules.",
    );
  if (
    home.physicalAbilityVersion !== away.physicalAbilityVersion ||
    (home.physicalAbilityVersion !== undefined &&
      home.physicalAbilityVersion !== 1) ||
    (home.physicalAbilityVersion === 1 && home.abilityVersion !== 1)
  )
    throw new Error(
      "Both teams must use valid, matching physical ability rules.",
    );
  if (
    home.chemistryVersion !== away.chemistryVersion ||
    (home.chemistryVersion !== undefined && home.chemistryVersion !== 1)
  )
    throw new Error("Both teams must use valid, matching chemistry rules.");
  const courtEnabled = home.courtVersion !== undefined;
  // Version 2 adds ball pressure, shot-zone intent, catch assists and foul spreading.
  const courtV2 = home.courtVersion === 2 || home.courtVersion === 3;
  // Version 3 keeps v2 rules and adds the size/rebound and blowout balance pass.
  const courtV3 = home.courtVersion === 3;
  const bodyEnabled = home.matchupVersion === 1;
  const possessionDepth = home.possessionVersion === 1;
  const advanced = home.typeTacticsVersion === 1;
  if (!advanced && options.scouting !== undefined)
    throw new Error("Opponent scouting requires type tactics rules.");
  const scouting = advanced
    ? validateMatchScouting(
        options.scouting ?? scoutingForMatch({}, home.id, away.id),
        home,
        away,
      )
    : undefined;
  const typed = home.typeMatchupsVersion === 1;
  const modern = home.simulationVersion === 2;
  const depthEnabled = Boolean(home.engineRules || away.engineRules);
  for (const team of [home, away])
    if (team.coach !== undefined && !validateCoach(team.coach))
      throw new Error("Unsupported trainer coach.");
  const prepared = (team: LeagueTeam, opponent: LeagueTeam) =>
    team.coach
      ? { ...team, ...coachGamePlan(team, opponent), rotationPlan: undefined }
      : team;
  const h = buildTeam(prepared(home, away), "home"),
    a = buildTeam(prepared(away, home), "away");
  // A fixed roster has only 128 directed matchups. Resolve these once rather
  // than allocating chart lookup keys during thousands of possession checks.
  if (typed) {
    for (const [attack, defense] of [
      [h, a],
      [a, h],
    ])
      for (const player of attack.players)
        for (const opponent of defense.players)
          player.typeEdges.set(
            opponent,
            typeMatchup(player.types, opponent.types).edge,
          );
    // Both coaches scout the same pre-decision lineups; neither sees the other
    // coach's simultaneous choice before making its own.
    const homeFloor = h.floor,
      awayFloor = a.floor;
    chooseLineup(h, 0, false, awayFloor);
    chooseLineup(a, 0, false, homeFloor);
    for (const team of [h, a]) {
      team.counterSubstitutions = 0;
      for (const player of team.players)
        player.box.started = team.floor.includes(player);
    }
  }
  if (!typed && (home.coach || away.coach)) {
    const hf = h.floor,
      af = a.floor;
    if (home.coach) chooseLineup(h, 0, false, af);
    if (away.coach) chooseLineup(a, 0, false, hf);
    for (const t of [h, a])
      for (const p of t.players) p.box.started = t.floor.includes(p);
  }
  refreshLineupChemistry(h);
  refreshLineupChemistry(a);
  const result: LeagueMatch = {
    ...(home.chemistryGrowthVersion === 1
      ? { chemistryMinutes: { home: {}, away: {} } }
      : {}),
    ...(typed
      ? {
          typeMatchups: {
            home: {
              advantaged: 0,
              resisted: 0,
              neutral: 0,
              shotAttempts: 0,
              shotChanceDelta: 0,
            },
            away: {
              advantaged: 0,
              resisted: 0,
              neutral: 0,
              shotAttempts: 0,
              shotChanceDelta: 0,
            },
          },
        }
      : {}),
    homeScore: 0,
    awayScore: 0,
    homeBox: h.players.map((p) => p.box),
    awayBox: a.players.map((p) => p.box),
    overtimePeriods: 0,
    possessions: 0,
    periods: [],
    leadChanges: 0,
    largestLead: { home: 0, away: 0 },
    plays: {
      transition: { home: 0, away: 0 },
      pickRoll: { home: 0, away: 0 },
      isolation: { home: 0, away: 0 },
      post: { home: 0, away: 0 },
      spotUp: { home: 0, away: 0 },
    },
    playerOfGameId: "",
    ...(modern || bodyEnabled
      ? {
          shotQuality: {
            home: { attempts: 0, expectedPoints: 0, points: 0 },
            away: { attempts: 0, expectedPoints: 0, points: 0 },
          },
        }
      : {}),
  };
  if (scouting) {
    const summary = (team: Team, opponent: Team): TypeTacticsSummary => {
      const history = scouting[team.side];
      const threat = [...opponent.players].sort(
        (x, y) => scoutedThreat(y, history) - scoutedThreat(x, history),
      )[0];
      return {
        priorMeetings: history.games,
        ...(scoutedThreat(threat, history) > 1
          ? { priorityThreatId: threat.box.pokemonId }
          : {}),
        crossMatches: 0,
        screens: 0,
        switches: 0,
        stays: 0,
        rolls: 0,
        helpRotations: 0,
        kickouts: 0,
        notes: history.games
          ? [
              `Scouted ${history.games} previous meeting${history.games === 1 ? "" : "s"}; prioritize proven scorers and observed coverage.`,
            ]
          : [
              "First meeting: use roster scouting until game evidence is available.",
            ],
      };
    };
    result.typeTactics = { home: summary(h, a), away: summary(a, h) };
  }
  const assignmentCache = new Map<
    Team,
    {
      attack: Player[];
      defense: Player[];
      minute: number;
      guards: Map<Player, Player>;
    }
  >();
  const assignments = (offense: Team, defense: Team) => {
    const prior = assignmentCache.get(defense);
    // Reassess fatigue each minute as well as substitutions/foul-out replacements.
    if (
      prior &&
      prior.minute === Math.floor(elapsedSeconds() / 60) &&
      prior.attack.every((p, i) => offense.floor[i] === p) &&
      prior.defense.every((p, i) => defense.floor[i] === p)
    )
      return prior.guards;
    const guards = assignTypeDefenders(
      offense.floor,
      defense.floor,
      scouting![defense.side],
    );
    const cross = offense.floor.filter(
      (p, i) => guards.get(p) !== defense.floor[i],
    ).length;
    result.typeTactics![defense.side].crossMatches += cross;
    assignmentCache.set(defense, {
      attack: [...offense.floor],
      defense: [...defense.floor],
      minute: Math.floor(elapsedSeconds() / 60),
      guards,
    });
    return guards;
  };
  if (
    home.abilityVersion === 1 ||
    depthEnabled ||
    possessionDepth ||
    courtEnabled ||
    home.coach ||
    away.coach
  )
    result.insights = {
      version: 1,
      coordinateSystem: courtEnabled
        ? "simulated-half-court"
        : "schematic-half-court",
      shots: [],
      lineups: [],
      defense: [...h.players, ...a.players].map((p) => ({
        teamId: p.box.teamId,
        playerId: p.box.playerId,
        matchups: 0,
        attempts: 0,
        contests: 0,
        pointsAllowed: 0,
        expectedPointsAllowed: 0,
        blocks: 0,
        steals: 0,
        deflections: 0,
        shootingFouls: 0,
      })),
      adjustments: [],
    };
  if (possessionDepth)
    result.insights!.possession = {
      version: 1,
      teams: [h, a].map((t) => emptyPossessionTeam(t.config.id)),
      players: [...h.players, ...a.players].map((p) =>
        emptyPossessionPlayer(p.box.teamId, p.box.playerId),
      ),
    };
  if (home.coach || away.coach)
    result.insights!.coaches = [h, a]
      .filter((t) => t.config.coach)
      .map((t) => ({
        teamId: t.config.id,
        coachId: t.config.coach!.id,
        ...coachGamePlan(
          t.side === "home" ? home : away,
          t.side === "home" ? away : home,
        ),
        starters: t.players
          .filter((p) => p.box.started)
          .map((p) => p.box.pokemonId),
        minutes: Object.fromEntries(
          t.players.map((p) => [p.box.slot, p.target]),
        ) as Record<import("./types").RosterSlot, number>,
      }));
  const coachObservations = new Map(
    [h, a].map((t) => [t.config.id, { attempts: 0, threes: 0, rim: 0 }]),
  );
  if (courtEnabled) result.insights!.court = [];
  let activeCourt: CourtSequence | undefined;
  const playerDetail = new Map(
    result.insights?.possession?.players.map((p) => [p.playerId, p]),
  );
  const teamDetail = new Map(
    result.insights?.possession?.teams.map((t) => [t.teamId, t]),
  );
  type Origin = { edge: number; turnover: boolean };
  const origins = new Map<Team, Origin>();
  let phase:
    | {
        team: Team;
        transition: boolean;
        secondChance: boolean;
        turnover: boolean;
        clutch: boolean;
      }
    | undefined;
  let lastRebounder: Player | undefined;
  let createdBy: Player | undefined;
  let screenBy: Player | undefined;
  let activeMatchup: MatchupEvidence | undefined;
  const chemistryMap = new Map<string, number>();
  const chemistry = (team: Team) => {
    if (chemistryEnabled(team.config) || !team.config.engineRules) return 0;
    const key = `${team.config.id}:${team.floor
      .map((p) => p.box.pokemonId)
      .sort()
      .join(",")}`;
    let bonus = chemistryMap.get(key);
    if (bonus === undefined) {
      bonus = lineupChemistry(
        team.floor.map((p) => p.profile),
        team.config.engineRules.familiarity,
      );
      chemistryMap.set(key, bonus);
    }
    return bonus;
  };
  const lineupMap = new Map<string, LineupSummary>();
  const defenseMap = new Map<string, DefenseSummary>(
    result.insights?.defense.map((d) => [d.playerId, d]),
  );
  const lineup = (team: Team) => {
    const playerIds = team.floor.map((p) => p.box.playerId).sort();
    const chemistry = getMatchChemistry(team);
    const chemistryContext = chemistry
      ? { tactic: team.config.tactic, defense: team.config.defense }
      : undefined;
    const key =
      playerIds.join("|") +
      (chemistryContext
        ? `:${chemistryContext.tactic}:${chemistryContext.defense}`
        : "");
    let entry = lineupMap.get(key);
    if (!entry) {
      entry = {
        teamId: team.config.id,
        playerIds,
        ...(chemistry ? { chemistry, chemistryContext } : {}),
        seconds: 0,
        possessions: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
      lineupMap.set(key, entry);
      result.insights!.lineups.push(entry);
    }
    return entry;
  };
  let randomSeed = seed >>> 0;
  const random = () => {
    const next = nextRandom(randomSeed);
    randomSeed = next.seed;
    return next.value;
  };
  const pick = <T>(
    values: T[],
    weight: (value: T, index: number) => number,
  ): T => {
    const weights = values.map((value, i) => Math.max(0.001, weight(value, i)));
    let n = random() * weights.reduce((total, value) => total + value, 0);
    for (let i = 0; i < values.length; i++) {
      n -= weights[i];
      if (n <= 0) return values[i];
    }
    return values[values.length - 1];
  };
  let lastLeader = 0,
    period = 0,
    gameMinute = 0,
    tickInPeriod = 0,
    periodTicks = 96;
  let courtSecondsInPeriod = 0;
  let completedPossessions = 0;
  const elapsedSeconds = () =>
    Math.min(period, 4) * 720 +
    Math.max(0, period - 4) * 300 +
    (courtEnabled ? courtSecondsInPeriod : tickInPeriod * 7.5);
  const recordShot = (
    event: Omit<ShotEvent, "index" | "period" | "elapsedSeconds" | "x" | "y">,
  ) => {
    if (event.countsAsAttempt) {
      const observed = coachObservations.get(event.offenseTeamId)!;
      observed.attempts++;
      observed.threes += Number(event.zone === "three");
      observed.rim += Number(event.zone === "rim");
    }
    if (!result.insights) return;
    if (activeCourt) {
      event = { ...event, courtSequence: result.insights!.court!.length - 1 };
      activeCourt.outcome = event.foul
        ? "foul"
        : event.blocked
          ? "blocked"
          : event.made
            ? "made"
            : "missed";
    }
    if (activeMatchup) event = { ...event, matchup: activeMatchup };
    if (possessionDepth) {
      event = {
        ...event,
        secondChance: phase?.secondChance ?? false,
        transition: phase?.transition ?? false,
        ...(createdBy && event.countsAsAttempt
          ? { creatorId: createdBy.box.playerId }
          : {}),
      };
      if (createdBy && event.countsAsAttempt) {
        const row = playerDetail.get(createdBy.box.playerId)!;
        row.potentialAssists++;
        row.expectedAssistPoints += event.expectedProbability * event.value;
      }
    }
    const index = result.insights.shots.length;
    // Independent display hash: never reads or advances the simulation RNG.
    let hash = (seed ^ Math.imul(index + 1, 2654435761)) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507) >>> 0;
    const angle = ((hash % 1000) / 1000) * Math.PI;
    const radius =
      event.zone === "rim"
        ? 5 + (hash % 6)
        : event.zone === "mid"
          ? 25 + (hash % 14)
          : 49 + (hash % 13);
    result.insights.shots.push({
      ...event,
      index,
      period: period + 1,
      elapsedSeconds: elapsedSeconds(),
      x: activeCourt
        ? (activeCourt.positions.find((p) => p.playerId === event.shooterId)!
            .x +
            25) *
          2
        : clamp(50 + Math.cos(angle) * radius, 3, 97),
      y: activeCourt
        ? (activeCourt.positions.find((p) => p.playerId === event.shooterId)!
            .y /
            47) *
          100
        : clamp(10 + Math.sin(angle) * radius, 3, 97),
    });
    const defender = defenseMap.get(event.defenderId)!;
    defender.matchups++;
    defender.attempts += Number(event.countsAsAttempt);
    defender.contests += Number(event.contested);
    defender.shootingFouls += Number(event.foul);
    defender.pointsAllowed += event.made ? event.value : 0;
    defender.expectedPointsAllowed += event.expectedProbability * event.value;
    if (event.blocked && event.blockerId)
      defenseMap.get(event.blockerId)!.blocks++;
  };
  const trainerAdapt = (team: Team, opponent: Team) => {
    const coach = getCoach(team.config.coach?.id ?? "");
    if (!coach || elapsedSeconds() < 60) return;
    const seen = coachObservations.get(opponent.config.id)!;
    const observation = {
      minute: Math.floor(elapsedSeconds() / 60),
      margin:
        team.side === "home"
          ? result.homeScore - result.awayScore
          : result.awayScore - result.homeScore,
      energy: team.floor.reduce((n, p) => n + p.energy, 0) / 5,
      opponentAttempts: seen.attempts,
      opponentThrees: seen.threes,
      opponentRim: seen.rim,
    };
    const change = coachAdjustment(coach, observation);
    for (const kind of ["tactic", "defense"] as const) {
      const next = change[kind];
      if (!next || next === team.config[kind]) continue;
      result.insights?.adjustments.push({
        teamId: team.config.id,
        period: period + 1,
        elapsedSeconds: elapsedSeconds(),
        kind,
        from: team.config[kind],
        to: next,
        reason: `${coach.name}: ${change.reason}`,
        evidence: `${observation.minute} minutes; margin ${observation.margin}; floor energy ${Math.round(observation.energy)}; ${seen.attempts} opponent attempts observed.`,
      });
      if (kind === "tactic") team.config.tactic = change.tactic!;
      else team.config.defense = change.defense!;
    }
  };
  const adapt = (
    team: Team,
    opponent: Team,
    observedCoverage: DefenseScheme,
  ) => {
    if (team.config.coach) {
      trainerAdapt(team, opponent);
      return;
    }
    if (
      !team.config.engineRules?.adaptiveCoaching ||
      !result.insights ||
      period === 0
    )
      return;
    const shots = result.insights.shots.filter(
      (s) => s.period === period && s.offenseTeamId === opponent.config.id,
    );
    if (shots.length < 8) return;
    const threes = shots.filter((s) => s.zone === "three").length,
      rim = shots.filter((s) => s.zone === "rim").length;
    const coverage =
      threes / shots.length >= 0.4
        ? "switch"
        : rim / shots.length >= 0.48
          ? "zone"
          : "man";
    if (coverage !== team.config.defense) {
      result.insights.adjustments.push({
        teamId: team.config.id,
        period: period + 1,
        elapsedSeconds: elapsedSeconds(),
        kind: "defense",
        from: team.config.defense,
        to: coverage,
        reason:
          coverage === "switch"
            ? "Stay connected to perimeter scorers"
            : coverage === "zone"
              ? "Put help around the rim"
              : "Return to individual matchups",
        evidence: `Previous period: ${threes}/${shots.length} perimeter attempts; ${rim}/${shots.length} at the rim.`,
      });
      team.config.defense = coverage;
    }
    const ownShots = result.insights.shots.filter(
      (s) => s.period === period && s.offenseTeamId === team.config.id,
    );
    if (ownShots.length < 8) return;
    const rimShots = ownShots.filter((s) => s.zone === "rim"),
      rimMakes = rimShots.filter((s) => s.made).length;
    const perimeterShots = ownShots.filter((s) => s.zone === "three"),
      perimeterMakes = perimeterShots.filter((s) => s.made).length;
    const nextTactic =
      observedCoverage === "zone" ||
      (rimShots.length >= 6 && rimMakes / rimShots.length < 0.4)
        ? "perimeter"
        : perimeterShots.length >= 6 &&
            perimeterMakes / perimeterShots.length < 0.28
          ? "interior"
          : team.config.tactic;
    if (nextTactic !== team.config.tactic) {
      result.insights.adjustments.push({
        teamId: team.config.id,
        period: period + 1,
        elapsedSeconds: elapsedSeconds(),
        kind: "tactic",
        from: team.config.tactic,
        to: nextTactic,
        reason:
          nextTactic === "perimeter"
            ? "Create space against paint resistance"
            : "Move inside after poor perimeter finishing",
        evidence: `Previous period: ${rimMakes}/${rimShots.length} rim finishes; ${perimeterMakes}/${perimeterShots.length} three-point finishes; opponent coverage ${observedCoverage}.`,
      });
      team.config.tactic = nextTactic;
    }
  };
  const margin = (team: Team) =>
    team.side === "home"
      ? result.homeScore - result.awayScore
      : result.awayScore - result.homeScore;
  const score = (
    offense: Team,
    defense: Team,
    player: Player,
    points: number,
  ) => {
    if (result.insights) {
      lineup(offense).pointsFor += points;
      lineup(defense).pointsAgainst += points;
    }
    if (possessionDepth) {
      const row = teamDetail.get(offense.config.id)!;
      row.points += points;
      if (phase?.team === offense) {
        if (phase.transition) row.transitionPoints += points;
        if (phase.secondChance) row.secondChancePoints += points;
        if (phase.turnover) row.pointsOffTurnovers += points;
        if (phase.clutch) row.clutchPoints += points;
      }
    }
    if (activeCourt?.offenseTeamId === offense.config.id)
      activeCourt.points += points;
    player.box.points += points;
    if (offense.side === "home") result.homeScore += points;
    else result.awayScore += points;
    result.periods[period][offense.side] += points;
    for (const p of offense.floor) p.box.plusMinus += points;
    for (const p of defense.floor) p.box.plusMinus -= points;
    const difference = result.homeScore - result.awayScore;
    const leader = Math.sign(difference);
    if (leader && lastLeader && leader !== lastLeader) result.leadChanges++;
    if (leader) lastLeader = leader;
    result.largestLead.home = Math.max(result.largestLead.home, difference);
    result.largestLead.away = Math.max(result.largestLead.away, -difference);
  };
  const freeThrow = (offense: Team, defense: Team, shooter: Player) => {
    shooter.box.fta++;
    const made =
      random() <
      clamp(
        0.48 +
          shooter.profile.attributes.freeThrow * 0.0047 -
          (100 - shooter.energy) * 0.00035,
        0.48,
        0.94,
      );
    if (made) {
      shooter.box.ftm++;
      score(offense, defense, shooter, 1);
    }
    return made;
  };
  const foul = (offense: Team, defense: Team, defender: Player) => {
    defender.box.fouls++;
    defense.fouls++;
    const technical = defender.box.fouls > 6;
    replaceFoulOut(defense, offense.floor);
    if (technical) {
      const shooter = offense.floor.reduce((best, p) =>
        p.profile.attributes.freeThrow > best.profile.attributes.freeThrow
          ? p
          : best,
      );
      freeThrow(offense, defense, shooter); // Dead-ball technical: possession is retained.
    }
  };
  const rebound = (
    offense: Team,
    defense: Team,
    freeThrowMiss = false,
    zone: Zone = "rim",
  ): boolean => {
    if (possessionDepth) {
      const profile = (p: Player) => ({
        id: p.box.playerId,
        ...(p.physicalAbilities || p.chemistry
          ? {
              abilityRebound:
                physicalPlayerEffects(p).rebound * (p.chemistry?.rebound ?? 1),
            }
          : {}),
        ...(p.body ? { body: p.body } : {}),
        offense: skill(p, "offensiveRebound"),
        defense: skill(p, "defensiveRebound"),
        strength: skill(p, "strength"),
        vertical: skill(p, "vertical"),
        speed: skill(p, "speed"),
        passing: skill(p, "passing"),
        discipline: p.profile.traits.discipline,
      });
      const battle = resolveRebound(
        offense.floor.map(profile),
        defense.floor.map(profile),
        {
          zone,
          tactic: offense.config.tactic,
          defenseTactic: defense.config.tactic,
          freeThrow: freeThrowMiss,
          ...(courtV3 ? { balanced: true } : {}),
        },
        random,
      );
      offense.floor.forEach((p, i) => {
        if (battle.attackWeights[i] > 0) {
          playerDetail.get(p.box.playerId)!.reboundChances++;
          if (physicalPlayerEffects(p).rebound !== 1)
            recordPhysicalAbility(p.box, "rebounds");
        }
      });
      defense.floor.forEach((p, i) => {
        const row = playerDetail.get(p.box.playerId)!;
        row.reboundChances++;
        if (physicalPlayerEffects(p).rebound !== 1)
          recordPhysicalAbility(p.box, "rebounds");
        if (battle.boxOuts[i]) row.boxOuts++;
      });
      const winner = (battle.offensive ? offense : defense).floor[
        battle.winner
      ];
      const key = battle.offensive ? "offensiveRebounds" : "defensiveRebounds";
      winner.box[key]++;
      playerDetail.get(winner.box.playerId)![key]++;
      lastRebounder = battle.offensive ? winner : undefined;
      if (!battle.offensive)
        origins.set(defense, { edge: battle.transitionEdge, turnover: false });
      return battle.offensive;
    }
    const pursuit = (p: Player, key: "offensiveRebound" | "defensiveRebound") =>
      skill(p, key) *
      physicalPlayerEffects(p).rebound *
      (p.chemistry?.rebound ?? 1);
    for (const p of [...offense.floor, ...defense.floor])
      if (physicalPlayerEffects(p).rebound !== 1)
        recordPhysicalAbility(p.box, "rebounds");
    const attack = average(offense.floor, (p) =>
      pursuit(p, "offensiveRebound"),
    );
    const defend = average(defense.floor, (p) =>
      pursuit(p, "defensiveRebound"),
    );
    const probability = clamp(
      (freeThrowMiss ? 0.13 : 0.235) +
        (attack - defend) * 0.0022 +
        (offense.config.tactic === "interior"
          ? 0.025
          : offense.config.tactic === "pace"
            ? -0.015
            : 0),
      0.07,
      0.42,
    );
    if (random() < probability) {
      pick(offense.floor, (p) => Math.pow(pursuit(p, "offensiveRebound"), 2))
        .box.offensiveRebounds++;
      return true;
    }
    pick(defense.floor, (p) => Math.pow(pursuit(p, "defensiveRebound"), 2)).box
      .defensiveRebounds++;
    defense.transition = 0.55;
    return false;
  };
  const freeThrows = (
    offense: Team,
    defense: Team,
    shooter: Player,
    count: number,
  ) => {
    let finalMade = false;
    for (let i = 0; i < count; i++)
      finalMade = freeThrow(offense, defense, shooter);
    return !finalMade && rebound(offense, defense, true);
  };
  const fieldGoal = (
    offense: Team,
    defense: Team,
    shooter: Player,
    zone: Zone,
    made: boolean,
    passer: Player | undefined,
    assistChance: number,
  ) => {
    shooter.box.fga++;
    if (zone === "rim") shooter.box.rimFga++;
    else if (zone === "mid") shooter.box.midFga++;
    else shooter.box.threePA++;
    if (!made) return;
    shooter.box.fgm++;
    if (zone === "rim") shooter.box.rimFgm++;
    else if (zone === "mid") shooter.box.midFgm++;
    else shooter.box.threePM++;
    score(offense, defense, shooter, zone === "three" ? 3 : 2);
    if (possessionDepth) {
      if (zone === "rim") teamDetail.get(offense.config.id)!.paintPoints += 2;
      if (createdBy && createdBy !== shooter) {
        createdBy.box.assists++;
        const row = playerDetail.get(createdBy.box.playerId)!;
        row.assists++;
        row.assistPoints += zone === "three" ? 3 : 2;
      }
      if (screenBy && screenBy !== shooter)
        playerDetail.get(screenBy.box.playerId)!.screenAssists++;
    } else if (passer && passer !== shooter && random() < assistChance)
      passer.box.assists++;
  };
  const changeEnergy = (player: Player, delta: number, floor = 25) => {
    const changed = abilityEnergyChange(
      player.box.pokemonId,
      player.energy,
      delta < 0 ? delta * (player.chemistry?.drain ?? 1) : delta,
      player.physicalAbilities === true,
      floor,
      player.masteryXp,
    );
    player.energy = changed.energy;
    if (changed.saved > 0)
      recordPhysicalAbility(player.box, "energySaved", changed.saved);
  };
  const advanceCourtClock = (duration: number) => {
    const seconds = Math.min(
      duration,
      periodTicks * 7.5 - courtSecondsInPeriod,
    );
    for (const team of [h, a]) {
      if (result.insights) lineup(team).seconds += seconds;
      if (result.chemistryMinutes)
        addSharedMinutes(
          result.chemistryMinutes[team.side],
          team.floor.map((p) => p.box.pokemonId),
          seconds / 60,
        );
      for (const player of team.players) {
        if (team.floor.includes(player)) {
          player.box.minutes += seconds / 60;
          player.consecutive += seconds / 60;
          const drain =
            1.55 +
            (100 - player.profile.attributes.stamina) * 0.025 +
            (team.config.tactic === "pace" ? 0.36 : 0) +
            (team.config.defense === "press" ? 0.4 : 0) +
            (player.body?.workload ?? 0) *
              (team.config.tactic === "pace" || team.config.defense === "press"
                ? 1.8
                : 1);
          changeEnergy(player, -(drain * seconds) / 60);
        } else {
          player.consecutive = 0;
          changeEnergy(
            player,
            ((4.7 + player.profile.attributes.stamina * 0.012) * seconds) / 60,
          );
        }
      }
    }
    courtSecondsInPeriod += seconds;
    tickInPeriod = courtSecondsInPeriod / 7.5;
  };
  const possession = (offense: Team, defense: Team) => {
    refreshLineupChemistry(offense);
    refreshLineupChemistry(defense);
    if (result.insights) lineup(offense).possessions++;
    let secondChance = false;
    const origin = origins.get(offense);
    origins.delete(offense);
    lastRebounder = undefined;
    if (possessionDepth) {
      const clutch =
        period >= 3 &&
        periodTicks - tickInPeriod <= 40 &&
        Math.abs(margin(offense)) <= 5;
      phase = {
        team: offense,
        transition: false,
        secondChance: false,
        turnover: origin?.turnover ?? false,
        clutch,
      };
      const row = teamDetail.get(offense.config.id)!;
      row.possessions++;
      if (clutch) row.clutchPossessions++;
    }
    let shotClock = 24;
    let firstAction = true;
    for (;;) {
      refreshLineupChemistry(offense);
      refreshLineupChemistry(defense);
      if (courtEnabled && periodTicks * 7.5 - courtSecondsInPeriod < 0.000001)
        return;
      activeCourt = undefined;
      createdBy = undefined;
      screenBy = undefined;
      activeMatchup = undefined;
      if (phase) phase.secondChance = secondChance;
      let guards = advanced ? assignments(offense, defense) : undefined;
      let switched = false;
      let kickoutPasser: Player | undefined;
      let help: ReturnType<typeof chooseTypeHelp>;
      const handler = pick(
        offense.floor,
        (p, role) =>
          Math.pow(
            skill(p, "ballHandling") * 0.45 +
              skill(p, "passing") * 0.35 +
              p.profile.traits.usage * 0.2,
            3,
          ) *
          (role === 0 ? 1.6 : 1) *
          (p.depth?.tendencies.passing ?? 1),
      );
      const screener = pick(
        offense.floor.filter((p) => p !== handler),
        (p) =>
          Math.pow(
            (p.profile.traits.screening + (p.depth?.physical.screening ?? 0)) *
              physicalPlayerEffects(p).screen *
              (p.chemistry?.screen ?? 1),
            3,
          ) *
          (bodyEnabled ? 0.75 + screenLeverage(p, guards!.get(handler)!) : 1) *
          (guards
            ? 1 +
              0.15 *
                (handler.typeEdges.get(guards.get(p)!)! -
                  handler.typeEdges.get(guards.get(handler)!)!)
            : 1),
      );
      const tactic = offense.config.tactic;
      const isClutch =
        period >= 3 &&
        periodTicks - tickInPeriod <= 24 &&
        Math.abs(margin(offense)) <= 10;
      const chaseThree =
        isClutch && margin(offense) < -2 && periodTicks - tickInPeriod <= 8;
      const breakEdge =
        possessionDepth && firstAction && !secondChance
          ? (origin?.edge ?? 0)
          : 0;
      const weights = [
        possessionDepth ? breakEdge * 65 : 9 + offense.transition * 25,
        30,
        17,
        17,
        27,
      ];
      if (tactic === "pace") {
        if (!possessionDepth || breakEdge > 0) weights[0] += 23;
        weights[3] *= 0.5;
      }
      if (tactic === "perimeter") {
        weights[4] += 25;
        weights[3] *= 0.5;
      }
      if (tactic === "interior") {
        weights[3] += 28;
        weights[4] *= 0.7;
      }
      if (tactic === "defense") {
        weights[0] *= 0.7;
        weights[1] += 7;
      }
      if (secondChance) {
        weights[0] = 0;
        weights[3] += 30;
      }
      if (scouting && scouting[offense.side].games) {
        const observed = scoutedCoverage(scouting[offense.side]);
        // Observed help invites spacing; frequent switches invite slips/rolls.
        weights[4] += 16 * observed.help;
        weights[1] += 12 * observed.switches;
      }
      if (bodyEnabled) {
        const matchups = offense.floor.map((p) =>
          matchupEdges(p, guards!.get(p)!),
        );
        for (let i = 0; i < PLAY_TYPES.length; i++) {
          const opportunities = matchups.map((e) =>
            preferenceFromEdges(e, PLAY_TYPES[i]),
          );
          weights[i] *=
            0.6 *
              average(
                offense.floor,
                (_p) => opportunities[offense.floor.indexOf(_p)],
              ) +
            0.4 * Math.max(...opportunities);
        }
      }
      if (chaseThree) weights[4] += 45;
      const play = pick(
        possessionDepth
          ? PLAY_TYPES.filter((_, i) => weights[i] > 0)
          : PLAY_TYPES,
        (p) => weights[PLAY_TYPES.indexOf(p)],
      );
      if (possessionDepth && phase) {
        phase.transition = play === "transition" && !secondChance;
        if (phase.transition && firstAction)
          teamDetail.get(offense.config.id)!.transitionPossessions++;
      }
      firstAction = false;
      result.plays[play][offense.side]++;
      offense.transition = 0;
      const zoneWeights = (shooter: Player, defender: Player) => {
        const shotWeights = [...baseShotMix[play]];
        if (shooter.depth) {
          shotWeights[0] *= shooter.depth.tendencies.rim;
          shotWeights[1] *= shooter.depth.tendencies.mid;
          shotWeights[2] *= shooter.depth.tendencies.three;
        }
        shotWeights[0] *= clamp(
          1 +
            (skill(shooter, "finishing") - skill(shooter, "threePoint")) *
              0.015,
          0.5,
          1.6,
        );
        shotWeights[2] *= clamp(
          1 +
            (skill(shooter, "threePoint") - skill(shooter, "finishing")) *
              0.017,
          0.45,
          1.65,
        );
        if (tactic === "perimeter") {
          shotWeights[0] *= 0.65;
          shotWeights[1] *= 0.7;
          shotWeights[2] *= 1.7;
        }
        if (tactic === "interior") {
          shotWeights[0] *= 1.45;
          shotWeights[2] *= 0.62;
        }
        if (defense.config.defense === "zone") {
          shotWeights[0] *= 0.82;
          shotWeights[2] *= 1.2;
        }
        if (bodyEnabled) {
          shotWeights[0] *= matchupPreference(
            shooter,
            defender,
            play === "post" ? "post" : "isolation",
          );
          shotWeights[2] *= matchupPreference(shooter, defender, "spotUp");
        }
        if (chaseThree) shotWeights[2] *= 3;
        return shotWeights as [number, number, number];
      };
      let court: ReturnType<typeof resolveCourtPossession> | undefined;
      if (courtEnabled) {
        court = resolveCourtPossession(
          {
            offense: offense.floor,
            defense: defense.floor,
            guards:
              guards ??
              new Map(offense.floor.map((p, i) => [p, defense.floor[i]])),
            handler,
            screener,
            play,
            tactic,
            scheme: defense.config.defense,
            coach: defense.config.coach,
            shotClock,
            periodRemaining: periodTicks * 7.5 - courtSecondsInPeriod,
            ...(secondChance && lastRebounder
              ? { putback: lastRebounder }
              : {}),
            ...(courtV2
              ? {
                  zoneIntent: (p: Player) =>
                    zoneWeights(
                      p,
                      guards?.get(p) ?? defense.floor[offense.floor.indexOf(p)],
                    ),
                }
              : {}),
          },
          random,
        );
        guards = court.guards;
        activeCourt = court.sequence;
        activeCourt.possession = completedPossessions;
        activeCourt.period = period + 1;
        activeCourt.elapsedSeconds = elapsedSeconds();
        result.insights!.court!.push(activeCourt);
        advanceCourtClock(activeCourt.seconds);
        shotClock = activeCourt.shotClock;
        switched = court.coverage === "switch";
        if (court.coverage && result.typeTactics) {
          result.typeTactics[offense.side].screens++;
          result.typeTactics[defense.side][switched ? "switches" : "stays"]++;
        }
        if (
          activeCourt.outcome === "turnover" ||
          activeCourt.outcome === "violation"
        ) {
          court.shooter.box.turnovers++;
          const live = activeCourt.outcome === "turnover" && random() < 0.64;
          if (live) {
            const thief = court.stealer ?? court.defender;
            thief.box.steals++;
            const row = defenseMap.get(thief.box.playerId);
            if (row) {
              row.steals++;
              row.deflections++;
            }
          }
          origins.set(defense, { edge: live ? 0.95 : 0, turnover: true });
          return;
        }
      }
      let shooter: Player;
      if (court) shooter = court.shooter;
      else if (play === "pickRoll" && guards) {
        switched = shouldSwitchScreen(
          handler,
          screener,
          guards.get(handler)!,
          guards.get(screener)!,
          defense.config.defense,
          scouting![defense.side],
        );
        if (switched) {
          // Keep the cached base assignments intact for the next possession.
          guards = new Map(guards);
          const original = guards.get(handler)!;
          guards.set(handler, guards.get(screener)!);
          guards.set(screener, original);
        }
        result.typeTactics![offense.side].screens++;
        result.typeTactics![defense.side][switched ? "switches" : "stays"]++;
        shooter = pick(
          offense.floor,
          (p) =>
            (p === handler ? 45 : p === screener ? 40 : 5) *
            (bodyEnabled
              ? matchupPreference(
                  p,
                  guards!.get(p)!,
                  p === screener ? "post" : "pickRoll",
                )
              : 1 + 0.15 * p.typeEdges.get(guards!.get(p)!)!) *
            (p === screener
              ? skill(p, "finishing")
              : p === handler
                ? skill(p, "ballHandling")
                : skill(p, "threePoint")),
        );
        if (shooter === screener) result.typeTactics![offense.side].rolls++;
      } else if (play === "pickRoll")
        shooter =
          random() < 0.38
            ? screener
            : random() < 0.75
              ? handler
              : pick(offense.floor, (p) => skill(p, "threePoint") ** 3);
      else
        shooter = pick(offense.floor, (p, role) => {
          const rating =
            play === "transition"
              ? skill(p, "speed") * 0.5 + skill(p, "finishing") * 0.5
              : play === "post"
                ? p.profile.traits.postGame
                : play === "spotUp"
                  ? skill(p, "threePoint") * 0.6 +
                    p.profile.traits.offBall * 0.4
                  : p.profile.traits.usage * 0.6 +
                    skill(p, "ballHandling") * 0.4;
          // Tendencies govern initiative; type coverage adds a bounded matchup preference.
          return (
            rating ** 3 *
            (p.depth?.tendencies.usage ?? 1) *
            (bodyEnabled
              ? matchupPreference(p, guards!.get(p)!, play)
              : typed
                ? 1 +
                  0.1 * p.typeEdges.get(guards?.get(p) ?? defense.floor[role])!
                : 1)
          );
        });
      let putback = court
        ? !!court.putback
        : !courtEnabled &&
          possessionDepth &&
          secondChance &&
          lastRebounder &&
          offense.floor.includes(lastRebounder) &&
          random() <
            clamp(
              0.34 + (skill(lastRebounder, "finishing") - 60) * 0.004,
              0.18,
              0.65,
            );
      if (putback) shooter = lastRebounder!;
      let shooterRole = offense.floor.indexOf(shooter);
      let defender =
        court?.defender ?? guards?.get(shooter) ?? defense.floor[shooterRole];
      if (
        !advanced &&
        defense.config.defense === "switch" &&
        play === "pickRoll"
      ) {
        defender =
          defense.floor[
            offense.floor.indexOf(shooter === screener ? handler : screener)
          ];
      }
      const shotWeights = zoneWeights(shooter, defender);
      let zone =
        court?.zone ??
        pick<Zone>(["rim", "mid", "three"], (_zone, i) => shotWeights[i]);
      if (putback) zone = "rim";
      if (!advanced && defense.config.defense === "zone" && zone === "rim")
        defender = pick(defense.floor, (p) => skill(p, "interiorDefense") ** 3);
      const coverageScheme = court
        ? switched
          ? "switch"
          : "man"
        : advanced && play === "pickRoll"
          ? screenCoverage(defense.config.defense, switched)
          : defense.config.defense;
      const bodyRoll = bodyEnabled ? random() : 0;
      const probe = bodyEnabled
        ? resolveBodyMatchup(
            shooter,
            defender,
            { play, zone, coverage: coverageScheme, screener },
            bodyRoll,
          )
        : undefined;
      if (!court && guards && zone === "rim") {
        help = chooseTypeHelp(
          shooter,
          defender,
          offense.floor,
          defense.floor,
          guards,
          scouting![defense.side],
          probe?.won,
        );
        if (help) {
          result.typeTactics![defense.side].helpRotations++;
          const read = clamp(
            0.2 +
              skill(shooter, "passing") * 0.003 +
              (skill(help.abandoned, "threePoint") - 55) * 0.004,
            0.15,
            0.7,
          );
          if (random() < read) {
            kickoutPasser = shooter;
            if (possessionDepth) putback = false;
            shooter = help.abandoned;
            shooterRole = offense.floor.indexOf(shooter);
            defender = help.helper;
            zone = "three";
            result.typeTactics![offense.side].kickouts++;
          }
        }
      }
      if (court) {
        kickoutPasser = court.kickout ? court.passer : undefined;
        if (court.helper) {
          const abandoned = offense.floor.find(
            (p) => court!.guards.get(p) === court!.helper,
          )!;
          help = { helper: court.helper, abandoned };
          if (result.typeTactics)
            result.typeTactics[defense.side].helpRotations++;
        }
        if (kickoutPasser && result.typeTactics)
          result.typeTactics[offense.side].kickouts++;
      }
      const bodyMatch = bodyEnabled
        ? resolveBodyMatchup(
            shooter,
            defender,
            {
              ...(court
                ? {
                    resolvedCourt: {
                      separated: court.sequence.defenderDistance > 4,
                    },
                  }
                : {}),
              play: court?.finishPlay ?? play,
              zone,
              coverage: coverageScheme,
              screener,
              helper: kickoutPasser ? undefined : help?.helper,
              kickout: !!kickoutPasser,
            },
            bodyRoll,
          )
        : undefined;
      const typeEdge = typed ? shooter.typeEdges.get(defender)! : 0;
      const helpEdge = advanced
        ? zone === "rim" && help
          ? shooter.typeEdges.get(help.helper)!
          : typeEdge
        : typed && zone === "rim"
          ? defense.floor.reduce(
              (sum, p) =>
                sum + (p === defender ? 0 : shooter.typeEdges.get(p)!),
              0,
            ) / 4
          : typeEdge;
      const typeEffect = typed
        ? {
            edge: typeEdge,
            logOdds:
              bodyMatch?.typeLogOdds ??
              typeShotLogOdds(typeEdge, zone, helpEdge),
          }
        : undefined;
      if (typeEffect && result.typeMatchups) {
        const summary = result.typeMatchups[offense.side];
        if (typeEffect.edge > 0) summary.advantaged++;
        else if (typeEffect.edge < 0) summary.resisted++;
        else summary.neutral++;
      }
      const pressure = average(
        defense.floor,
        (p) => skill(p, "steal") * 0.5 + skill(p, "perimeterDefense") * 0.5,
      );
      const carrier =
        court?.shooter ??
        (bodyEnabled && kickoutPasser
          ? kickoutPasser
          : play === "post"
            ? shooter
            : handler);
      const carrierDefender =
        guards?.get(carrier) ?? defense.floor[offense.floor.indexOf(carrier)];
      const typePressure = typed
        ? carrierDefender.typeEdges.get(carrier)! * 0.012
        : 0;
      const carrierMatch = bodyEnabled
        ? resolveBodyMatchup(
            carrier,
            carrierDefender,
            {
              play,
              zone: play === "post" ? "rim" : zone,
              coverage: coverageScheme,
            },
            bodyRoll,
          )
        : undefined;
      const turnoverRate = clamp(
        0.105 +
          (carrierMatch?.turnoverDelta ?? 0) +
          typePressure +
          (pressure - skill(carrier, "ballHandling")) * 0.0016 +
          (65 - carrier.profile.traits.decisionMaking) * 0.0005 +
          (defense.config.defense === "press" ? 0.035 : 0) +
          (play === "transition" ? 0.013 : 0) -
          (offense.side === "home" ? 0.004 : 0) -
          chemistry(offense) * 0.6,
        0.045,
        0.28,
      );
      const pressureRoll = random();
      // Version 2 court possessions already risk passes and drives, so apply a
      // reduced share of the carrier-pressure rate (press, steals, handling).
      if (
        (!court || courtV2) &&
        pressureRoll < turnoverRate * (court ? COURT_PRESSURE_SHARE : 1)
      ) {
        if (activeCourt) {
          activeCourt.outcome = "turnover";
          activeCourt.actions = activeCourt.actions.filter(
            (a) => a.kind !== "shoot",
          );
          activeCourt.actions.push({
            kind: "turnover",
            playerId: carrier.box.playerId,
            clock: activeCourt.shotClock,
          });
        }
        carrier.box.turnovers++;
        let liveBall = false;
        if (random() < 0.64) {
          const thief = pick(
            defense.floor,
            (p) =>
              skill(p, "steal") ** 2 *
              (typed ? 1 + 0.1 * p.typeEdges.get(carrier)! : 1),
          );
          thief.box.steals++;
          liveBall = true;
          const record = defenseMap.get(thief.box.playerId);
          if (record) {
            record.steals++;
            record.deflections++;
          }
        }
        defense.transition = 1;
        if (possessionDepth)
          origins.set(defense, { edge: liveBall ? 0.95 : 0, turnover: true });
        return;
      }
      // A live tipped pass retains possession but disrupts the upcoming shot.
      let disrupted = false;
      if (
        !court &&
        defense.config.engineRules &&
        pressureRoll <
          turnoverRate + clamp(0.025 + (pressure - 60) * 0.0003, 0.01, 0.04)
      ) {
        const deflector = pick(defense.floor, (p) => skill(p, "steal") ** 2);
        defenseMap.get(deflector.box.playerId)!.deflections++;
        disrupted = true;
      }
      // Illegal screens and charges are personal fouls, without defensive bonus FTs.
      if (
        random() <
        (play === "pickRoll" ? 0.012 : 0.007) +
          (70 - carrier.profile.traits.discipline) * 0.00012
      ) {
        const offender = play === "pickRoll" ? screener : carrier;
        if (activeCourt) {
          activeCourt.outcome = "turnover";
          activeCourt.actions = activeCourt.actions.filter(
            (a) => a.kind !== "shoot",
          );
          activeCourt.actions.push({
            kind: "turnover",
            playerId: offender.box.playerId,
            clock: activeCourt.shotClock,
          });
        }
        offender.box.turnovers++;
        if (possessionDepth) origins.set(defense, { edge: 0, turnover: true });
        offender.box.fouls++;
        const technical = offender.box.fouls > 6;
        replaceFoulOut(offense, defense.floor);
        if (technical)
          freeThrow(
            defense,
            offense,
            defense.floor.reduce((best, p) =>
              p.profile.attributes.freeThrow > best.profile.attributes.freeThrow
                ? p
                : best,
            ),
          );
        return;
      }
      const intentional =
        isClutch &&
        margin(defense) < -2 &&
        margin(defense) >= -9 &&
        periodTicks - tickInPeriod <= 5;
      const reachRate =
        0.032 +
        (defense.config.defense === "press" ? 0.025 : 0) +
        (65 - defender.profile.traits.discipline) * 0.0003;
      if (intentional || random() < reachRate) {
        const fouler =
          courtV2 && !intentional
            ? pick(
                defense.floor,
                (p) =>
                  (p === defender ? 2.2 : 1) *
                  clamp(1.6 - p.profile.traits.discipline / 100, 0.5, 1.5),
              )
            : defender;
        if (activeCourt) {
          activeCourt.outcome = "foul";
          activeCourt.actions = activeCourt.actions.filter(
            (a) => a.kind !== "shoot",
          );
          activeCourt.actions.push({
            kind: "foul",
            playerId: fouler.box.playerId,
            clock: activeCourt.shotClock,
          });
        }
        foul(offense, defense, fouler);
        if (defense.fouls >= (period < 4 ? 5 : 4)) {
          if (!freeThrows(offense, defense, carrier, 2)) return;
          secondChance = true;
          shotClock = 14;
        } else if (courtEnabled) shotClock = Math.max(14, shotClock);
        continue;
      }
      const spacing =
        court?.spacing ??
        average(
          offense.floor.filter((p) => p !== shooter),
          (p) => skill(p, "threePoint"),
        );
      const courtDistance = (p: Player) => {
        if (!court) return 0;
        const point = court.sequence.positions.find(
          (p) => p.playerId === shooter.box.playerId,
        )!;
        const other = court.sequence.positions.find(
          (q) => q.playerId === p.box.playerId,
        )!;
        return Math.hypot(point.x - other.x, point.y - other.y);
      };
      const nearby = court
        ? defense.floor.filter((p) => courtDistance(p) <= 14)
        : defense.floor;
      const protection = nearby.length
        ? average(
            nearby,
            (p) => skill(p, "interiorDefense") * 0.6 + skill(p, "block") * 0.4,
          )
        : 35;
      const matchup =
        zone === "rim"
          ? (skill(shooter, "strength") - skill(defender, "strength")) * 0.0006
          : (skill(shooter, "speed") - skill(defender, "speed")) * 0.00045;
      const passer = court
        ? court.passer
        : putback
          ? undefined
          : (kickoutPasser ??
            (shooter !== handler
              ? handler
              : play === "spotUp" || play === "pickRoll"
                ? pick(
                    offense.floor.filter((p) => p !== shooter),
                    (p) => skill(p, "passing") ** 2,
                  )
                : undefined));
      const passingBonus = passer
        ? (skill(passer, "passing") - 40) *
          (play === "spotUp" ? 0.0009 : 0.00055)
        : 0;
      const screenBonus =
        play === "pickRoll"
          ? (screener.profile.traits.screening - 35) *
            0.0008 *
            ((advanced ? switched : defense.config.defense === "switch")
              ? 0.4
              : 1)
          : 0;
      const coverage =
        coverageScheme === "zone"
          ? zone === "rim"
            ? -0.035
            : zone === "three"
              ? 0.023
              : 0
          : coverageScheme === "press"
            ? 0.012
            : coverageScheme === "switch"
              ? (60 - defender.profile.traits.switchability) * 0.0004
              : 0;
      let accuracy =
        zone === "rim"
          ? 0.545 +
            (skill(shooter, "finishing") - 60) * 0.0038 -
            (skill(defender, "interiorDefense") - 60) * 0.0018 -
            (protection - 60) * 0.001
          : zone === "mid"
            ? 0.39 +
              (skill(shooter, "midRange") - 60) * 0.0037 -
              (skill(defender, "perimeterDefense") - 60) * 0.0017
            : 0.335 +
              (skill(shooter, "threePoint") - 60) * 0.0036 -
              (skill(defender, "perimeterDefense") - 60) * 0.0016;
      accuracy +=
        matchup +
        passingBonus +
        screenBonus +
        coverage +
        (spacing - 55) * 0.00065;
      if (zone !== "rim")
        accuracy -=
          (defender.profile.traits.closeout - 60) *
          (play === "spotUp" ? 0.0008 : 0.00035);
      if (play === "transition")
        accuracy +=
          0.045 + (skill(shooter, "speed") - skill(defender, "speed")) * 0.0008;
      if (defense.config.tactic === "defense") accuracy -= 0.014;
      if (offense.side === "home") accuracy += 0.011;
      if (isClutch)
        accuracy += (shooter.profile.attributes.composure - 60) * 0.0007;
      accuracy = clamp(accuracy, 0.13, 0.82);
      if (modern || bodyEnabled)
        accuracy = evaluateShot({
          resolvedMatchup: bodyEnabled,
          shooter: shooter.profile,
          defender: defender.profile,
          shooterHeight: POKEMON_BY_ID.get(shooter.box.pokemonId)!.heightM,
          defenderHeight: POKEMON_BY_ID.get(defender.box.pokemonId)!.heightM,
          zone,
          play,
          coverage: coverageScheme,
          shooterEnergy: shooter.energy,
          defenderEnergy: defender.energy,
          spacing,
          protection,
          passing: passer ? skill(passer, "passing") : undefined,
          screening:
            screener.profile.traits.screening +
            (screener.depth?.physical.screening ?? 0),
          roleFitPenalty:
            Math.max(...Object.values(shooter.profile.positions)) -
            shooter.profile.positions[POSITIONS[shooterRole]],
          home: offense.side === "home",
          clutch: isClutch,
          defenseFirst: defense.config.tactic === "defense",
        }).probability;
      // This coverage event explicitly alters resolution; it is not inferred from the outcome.
      const contested = court
        ? random() <
          clamp(0.92 - court.sequence.defenderDistance * 0.085, 0.12, 0.94)
        : bodyMatch
          ? random() < bodyMatch.contestChance
          : depthEnabled
            ? random() <
              clamp(
                0.7 +
                  (defender.profile.traits.closeout - skill(shooter, "speed")) *
                    0.003,
                0.4,
                0.9,
              )
            : true;
      if (depthEnabled) {
        const attack = shooter.depth?.physical,
          guard = defender.depth?.physical;
        const physical =
          zone === "rim"
            ? ((attack?.postContact ?? 0) - (guard?.postContact ?? 0)) * 0.002 +
              ((attack?.reach ?? 0) - (guard?.reach ?? 0)) * 0.012
            : ((attack?.agility ?? 0) - (guard?.agility ?? 0)) * 0.001;
        const context = {
          zone,
          play,
          clutch: isClutch,
          secondChance,
          contested,
          energy: shooter.energy,
        };
        accuracy = clamp(
          accuracy +
            (bodyEnabled ? 0 : clamp(physical, -0.025, 0.025)) +
            chemistry(offense) +
            (contested ? -0.008 : 0.012) -
            (disrupted ? 0.012 : 0) +
            (shooter.depth
              ? signatureImpact(
                  shooter.depth,
                  "shooter",
                  context,
                  !!offense.config.engineRules?.abilities &&
                    offense.config.abilityVersion !== 1,
                )
              : 0) +
            (passer?.depth
              ? signatureImpact(
                  passer.depth,
                  "passer",
                  context,
                  !!offense.config.engineRules?.abilities &&
                    offense.config.abilityVersion !== 1,
                )
              : 0) +
            (defender.depth
              ? signatureImpact(
                  defender.depth,
                  "defender",
                  { ...context, energy: defender.energy },
                  !!defense.config.engineRules?.abilities &&
                    defense.config.abilityVersion !== 1,
                )
              : 0),
          0.1,
          0.88,
        );
      }
      if (advanced && !bodyEnabled)
        accuracy = clamp(
          accuracy +
            (kickoutPasser ? 0.025 : help && zone === "rim" ? -0.02 : 0),
          0.1,
          0.88,
        );
      if (court)
        accuracy = clamp(
          applyTypeShotEffect(accuracy, court.sequence.shotLogOdds),
          0.1,
          0.88,
        );
      const beforePhysical = accuracy;
      if (bodyMatch)
        accuracy = clamp(
          applyTypeShotEffect(accuracy, bodyMatch.physicalLogOdds),
          0.1,
          0.88,
        );
      const physicalChanceDelta = accuracy - beforePhysical;
      if (courtV3)
        // Version 3 score state: a comfortable lead relaxes, a deficit raises effort.
        accuracy = clamp(
          accuracy -
            clamp(
              margin(offense) * SCORE_STATE_PER_POINT,
              -SCORE_STATE_CAP,
              SCORE_STATE_CAP,
            ),
          0.1,
          0.88,
        );
      // Measure type impact against the completed basketball/depth probability.
      let untypedAccuracy = accuracy;
      if (typeEffect)
        accuracy = clamp(
          applyTypeShotEffect(accuracy, typeEffect.logOdds),
          0.1,
          0.88,
        );
      const assistChance = clamp(
        (play === "spotUp"
          ? 0.88
          : play === "pickRoll"
            ? 0.73
            : play === "transition"
              ? 0.62
              : play === "post"
                ? 0.47
                : 0.3) * (passer ? skill(passer, "passing") / 70 : 0),
        0,
        0.94,
      );
      if (possessionDepth) {
        if (
          passer &&
          random() <
            (courtV2 && court
              ? catchAssistChance(
                  court.droveAfterCatch,
                  skill(passer, "passing"),
                  disrupted,
                )
              : creationChance(play, skill(passer, "passing"), disrupted))
        )
          createdBy = passer;
        if (
          (court
            ? court.sequence.actions.some((a) => a.kind === "screen")
            : play === "pickRoll") &&
          screener !== shooter &&
          !putback
        )
          screenBy = screener;
        const boost =
          (createdBy
            ? clamp((skill(createdBy, "passing") - 35) * 0.00035, 0, 0.022)
            : 0) +
          (phase?.transition ? breakEdge * 0.025 : 0) +
          (putback ? 0.012 : 0);
        accuracy = clamp(accuracy + boost, 0.1, 0.88);
        untypedAccuracy = clamp(untypedAccuracy + boost, 0.1, 0.88);
      }
      if (bodyMatch)
        activeMatchup = {
          ...bodyMatch,
          attackerId: shooter.box.playerId,
          defenderId: defender.box.playerId,
          attackerHeight: shooter.body!.heightM,
          defenderHeight: defender.body!.heightM,
          attackerWeight: shooter.body!.weightKg,
          defenderWeight: defender.body!.weightKg,
          physicalChanceDelta,
          typeChanceDelta: accuracy - untypedAccuracy,
        };
      // Shared ability rules run after basketball, body and type resolution. No extra RNG.
      // A support activation requires the actual creator when multi-action rules are active.
      const abilityEffects: NonNullable<ShotEvent["abilityEffects"]> = [];
      const candidates: [Player | undefined, AbilityRole, Team][] = [
        [shooter, "shooter", offense],
        [possessionDepth ? createdBy : passer, "passer", offense],
        [defender, "defender", defense],
      ];
      for (const [player, role, team] of candidates) {
        if (!player || !abilitiesEnabled(team.config)) continue;
        const delta = abilityImpact(
          player.box.pokemonId,
          role,
          {
            zone,
            play,
            contested,
            energy: player.energy,
            clutch: isClutch,
            secondChance,
            period: period + 1,
            margin:
              team.side === "home"
                ? result.homeScore - result.awayScore
                : result.awayScore - result.homeScore,
          },
          player.masteryXp,
        );
        const next = clamp(accuracy + delta, 0.1, 0.88);
        const applied = next - accuracy;
        if (!applied) continue;
        accuracy = next;
        untypedAccuracy = clamp(untypedAccuracy + applied, 0.1, 0.88);
        abilityEffects.push({
          playerId: player.box.playerId,
          abilityId: speciesAbility(player.box.pokemonId).id,
          role,
          probabilityDelta: applied,
        });
      }
      const activateAbilities = (scale = 1) => {
        for (const effect of abilityEffects) {
          const player = candidates.find(
            ([p, role]) =>
              p?.box.playerId === effect.playerId && role === effect.role,
          )![0]!;
          addAbilityActivation(player.box, effect.role);
        }
        return abilityEffects.length
          ? {
              abilityEffects: abilityEffects.map((e) => ({
                ...e,
                probabilityDelta: e.probabilityDelta * scale,
              })),
            }
          : {};
      };
      const shootingFoulRate = clamp(
        (zone === "rim" ? 0.16 : zone === "mid" ? 0.075 : 0.035) +
          (bodyMatch?.foulDelta ?? 0) +
          (shooter.profile.traits.drawFoul -
            defender.profile.traits.discipline) *
            0.0007 +
          (defense.config.defense === "press" ? 0.01 : 0),
        0.015,
        0.25,
      );
      if (random() < shootingFoulRate) {
        const foulProbability = accuracy * (zone === "rim" ? 0.4 : 0.25);
        const andOne = random() < foulProbability;
        recordShot({
          ...activateAbilities(zone === "rim" ? 0.4 : 0.25),
          offenseTeamId: offense.config.id,
          defenseTeamId: defense.config.id,
          shooterId: shooter.box.playerId,
          defenderId: defender.box.playerId,
          zone,
          play,
          value: zone === "three" ? 3 : 2,
          expectedProbability: foulProbability,
          made: andOne,
          blocked: false,
          foul: true,
          countsAsAttempt: andOne,
          ...(possessionDepth
            ? { putback: !!putback, kickout: !!kickoutPasser }
            : {}),
          contested,
        });
        if (andOne)
          fieldGoal(
            offense,
            defense,
            shooter,
            zone,
            true,
            passer,
            assistChance,
          );
        foul(offense, defense, defender);
        if (
          !freeThrows(
            offense,
            defense,
            shooter,
            andOne ? 1 : zone === "three" ? 3 : 2,
          )
        )
          return;
        secondChance = true;
        shotClock = 14;
        continue;
      }
      const blockers = court
        ? defense.floor.filter((p) => courtDistance(p) <= 10)
        : defense.floor;
      const blocker =
        zone === "rim" && blockers.length > 0
          ? pick(
              blockers,
              (p) =>
                skill(p, "block") ** 3 *
                (advanced
                  ? p === defender || p === help?.helper
                    ? 2
                    : 0.4
                  : 1),
            )
          : defender;
      const blockBody = bodyEnabled
        ? resolveBodyMatchup(
            shooter,
            blocker,
            { play, zone, coverage: coverageScheme },
            bodyRoll,
          )
        : undefined;
      const blockRate =
        (court ? clamp((10 - courtDistance(blocker)) / 8, 0, 1) : 1) *
        clamp(
          (zone === "rim" ? 0.052 : zone === "mid" ? 0.021 : 0.009) +
            (blockBody?.blockDelta ?? 0) +
            (typed
              ? blocker.typeEdges.get(shooter)! *
                (zone === "rim" ? 0.008 : 0.003)
              : 0) +
            (skill(blocker, "block") - skill(shooter, "vertical")) *
              (zone === "rim" ? 0.0008 : 0.00025),
          0.003,
          0.14,
        );
      const blocked = random() < blockRate;
      const made = !blocked && random() < accuracy;
      if (result.typeMatchups) {
        const summary = result.typeMatchups[offense.side];
        summary.shotAttempts++;
        summary.shotChanceDelta += accuracy - untypedAccuracy;
      }
      if (result.shotQuality) {
        const quality = result.shotQuality[offense.side],
          value = zone === "three" ? 3 : 2;
        quality.attempts++;
        quality.expectedPoints += accuracy * (1 - blockRate) * value;
        quality.points += made ? value : 0;
      }
      recordShot({
        ...(!blocked ? activateAbilities(1 - blockRate) : {}),
        offenseTeamId: offense.config.id,
        defenseTeamId: defense.config.id,
        shooterId: shooter.box.playerId,
        defenderId: defender.box.playerId,
        blockerId: blocked ? blocker.box.playerId : undefined,
        zone,
        play,
        value: zone === "three" ? 3 : 2,
        expectedProbability: accuracy * (1 - blockRate),
        made,
        blocked,
        foul: false,
        countsAsAttempt: true,
        ...(possessionDepth
          ? { putback: !!putback, kickout: !!kickoutPasser }
          : {}),
        contested,
      });
      if (blocked) blocker.box.blocks++;
      fieldGoal(offense, defense, shooter, zone, made, passer, assistChance);
      if (made || !rebound(offense, defense, false, zone)) return;
      secondChance = true;
      shotClock = 14;
    }
  };
  const tempo = (team: Team) =>
    team.config.tactic === "pace"
      ? 0.085
      : team.config.tactic === "defense"
        ? -0.055
        : team.config.tactic === "interior"
          ? -0.015
          : 0;
  const possessionRate = 0.51 + (tempo(h) + tempo(a)) / 2;
  const openingTip = random() < 0.5 ? h : a;
  // Eight 7.5-second clock ticks per minute make exact fractional minute totals.
  // Normal substitutions happen at minute boundaries; foul-outs are immediate.
  while (period < 4 || result.homeScore === result.awayScore) {
    if (period >= 4) result.overtimePeriods++;
    periodTicks = period < 4 ? 96 : 40;
    tickInPeriod = 0;
    courtSecondsInPeriod = 0;
    const previousHomeCoverage = h.config.defense,
      previousAwayCoverage = a.config.defense;
    adapt(h, a, previousAwayCoverage);
    adapt(a, h, previousHomeCoverage);
    result.periods.push({ home: 0, away: 0 });
    h.fouls = a.fouls = 0;
    if (possessionDepth) {
      origins.clear();
      phase = undefined;
      h.transition = a.transition = 0;
    }
    let offense =
      period >= 4
        ? random() < 0.5
          ? h
          : a
        : period === 0 || period === 3
          ? openingTip
          : openingTip === h
            ? a
            : h;
    if (courtEnabled) {
      while (courtSecondsInPeriod < periodTicks * 7.5 - 0.000001) {
        const minute = Math.floor(elapsedSeconds() / 60);
        if (minute !== gameMinute) {
          if (minute % 3 === 0 || minute >= 43) {
            trainerAdapt(h, a);
            trainerAdapt(a, h);
          }
          const close =
            minute >= 44 && Math.abs(result.homeScore - result.awayScore) <= 12;
          const lead = Math.abs(result.homeScore - result.awayScore);
          // Version 3 garbage time: both coaches empty the bench once a game is decided.
          const garbage =
            courtV3 &&
            period < 4 &&
            (minute >= 42 ? lead >= 16 : minute >= 36 && lead >= 22);
          const homeFloor = h.floor,
            awayFloor = a.floor;
          chooseLineup(h, minute, close, awayFloor, garbage);
          chooseLineup(a, minute, close, homeFloor, garbage);
          gameMinute = minute;
        }
        const defense = offense === h ? a : h;
        possession(offense, defense);
        completedPossessions++;
        offense = defense;
      }
    } else
      for (tickInPeriod = 0; tickInPeriod < periodTicks; tickInPeriod++) {
        if (tickInPeriod % 8 === 0) {
          if (gameMinute % 3 === 0 || gameMinute >= 43) {
            trainerAdapt(h, a);
            trainerAdapt(a, h);
          }
          const close =
            gameMinute >= 44 &&
            Math.abs(result.homeScore - result.awayScore) <= 12;
          if (gameMinute > 0) {
            const homeFloor = h.floor,
              awayFloor = a.floor;
            chooseLineup(h, gameMinute, close, awayFloor);
            chooseLineup(a, gameMinute, close, homeFloor);
          }
          for (const team of [h, a])
            for (const player of team.players) {
              if (team.floor.includes(player)) player.consecutive++;
              else player.consecutive = 0;
            }
          gameMinute++;
        }
        if (result.insights) {
          lineup(h).seconds += 7.5;
          lineup(a).seconds += 7.5;
        }
        if (result.chemistryMinutes)
          for (const team of [h, a])
            addSharedMinutes(
              result.chemistryMinutes[team.side],
              team.floor.map((p) => p.box.pokemonId),
              0.125,
            );
        for (const team of [h, a])
          for (const player of team.players) {
            if (team.floor.includes(player)) {
              player.box.minutes += 0.125;
              const drain =
                1.55 +
                (100 - player.profile.attributes.stamina) * 0.025 +
                (team.config.tactic === "pace" ? 0.36 : 0) +
                (team.config.defense === "press" ? 0.4 : 0) +
                (player.body
                  ? player.body.workload *
                    (team.config.tactic === "pace" ||
                    team.config.defense === "press"
                      ? 1.8
                      : 1)
                  : (player.depth?.physical.fatigue ?? 0));
              changeEnergy(player, -drain * 0.125);
            } else
              changeEnergy(
                player,
                (4.7 + player.profile.attributes.stamina * 0.012) * 0.125,
              );
          }
        const defense = offense === h ? a : h;
        const rush =
          period >= 3 &&
          periodTicks - tickInPeriod < 8 &&
          margin(offense) < -2 &&
          margin(offense) > -12
            ? 0.17
            : 0;
        if (
          random() <
          (depthEnabled ? 0.51 + (tempo(h) + tempo(a)) / 2 : possessionRate) +
            rush
        ) {
          possession(offense, defense);
          completedPossessions++;
          offense = defense;
        }
      }
    for (const team of [h, a])
      for (const p of team.players) changeEnergy(p, period === 1 ? 12 : 5);
    period++;
  }
  if (courtEnabled)
    for (const team of [h, a]) {
      // Stable fractional minute totals for reports and archival validation.
      const total = 240 + 25 * result.overtimePeriods;
      const played = team.players.filter((p) => p.box.minutes > 0);
      for (const p of played)
        p.box.minutes = Math.round(p.box.minutes * 1e6) / 1e6;
      played.at(-1)!.box.minutes =
        total - played.slice(0, -1).reduce((n, p) => n + p.box.minutes, 0);
    }
  result.possessions = Math.round(completedPossessions / 2);
  if (result.typeMatchups) {
    result.typeMatchups.home.counterSubstitutions = h.counterSubstitutions;
    result.typeMatchups.away.counterSubstitutions = a.counterSubstitutions;
  }
  const best = [...result.homeBox, ...result.awayBox].reduce((best, p) => {
    const value = (b: LeagueBox) =>
      b.points +
      b.assists * 1.5 +
      (b.offensiveRebounds + b.defensiveRebounds) * 1.2 +
      b.steals * 2 +
      b.blocks * 1.8 -
      b.turnovers * 1.4 -
      (b.fga - b.fgm) * 0.45 +
      b.plusMinus * 0.12;
    return value(p) > value(best) ? p : best;
  });
  result.playerOfGameId = best.playerId;
  // Quarter evidence is retained internally for coaching even when callers only need a compact result.
  if (possessionDepth)
    for (const p of [...h.players, ...a.players])
      playerDetail.get(p.box.playerId)!.games = Number(p.box.minutes > 0);
  if (result.chemistryMinutes)
    for (const side of ["home", "away"] as const)
      result.chemistryMinutes[side] = finishPairMinutes(
        result.chemistryMinutes[side],
      );
  if (options.collectInsights === false) delete result.insights;
  if (result.typeTactics)
    for (const side of ["home", "away"] as const) {
      const report = result.typeTactics[side];
      if (report.crossMatches)
        report.notes.push(
          "Cross-match defenders to balance type resistance, role fit and fatigue.",
        );
      if (report.switches)
        report.notes.push(
          "Switch screens when the new pair of matchups is safer.",
        );
      if (report.stays)
        report.notes.push(
          "Keep assignments when a switch would expose a mismatch.",
        );
      if (report.helpRotations)
        report.notes.push(
          "Send resistant help while accounting for the shooter left open.",
        );
      if (report.kickouts)
        report.notes.push(
          "Read the help rotation and pass to the uncovered shooter.",
        );
    }
  if (home.moraleVersion === 1)
    result.moraleReport = moraleGameReport(home, away, result);
  if (home.abilityMasteryVersion === 1)
    result.masteryReport = masteryGameReport(home, away, result);
  return result;
}
