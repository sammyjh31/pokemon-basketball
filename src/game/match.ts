import { POKEMON_BY_ID } from "../data/pokemon";
import { clamp, rotationMinutes } from "./ratings";
import { nextRandom } from "./random";
import { DEVELOPMENT_SKILLS } from "./developmentTypes";
import { playerProfile, type PlayerProfile } from "./playerProfile";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type Attributes,
  type LeagueBox,
  type LeagueMatch,
  type LeagueTeam,
  type PlayType,
} from "./types";

type Side = "home" | "away";
type Zone = "rim" | "mid" | "three";
interface Player {
  profile: PlayerProfile;
  box: LeagueBox;
  target: number;
  energy: number;
  consecutive: number;
}
interface Team {
  config: LeagueTeam;
  players: Player[];
  floor: Player[]; // Ordered PG, SG, SF, PF, C, including substitute roles.
  side: Side;
  fouls: number;
  transition: number;
}
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
  const key = `${ids.join(",")}:${config.rotation}:${offsetsKey}`;
  let targets = targetCache.get(key);
  if (!targets) {
    targets = rotationMinutes(
      config.roster,
      config.rotation,
      config.development,
    );
    // A bounded cache covers many seasons without retaining every custom roster.
    if (targetCache.size > 240) targetCache.clear();
    targetCache.set(key, targets);
  }
  const players = ROSTER_SLOTS.map((slot, index): Player => {
    const pokemonId = ids[index]!;
    return {
      profile: playerProfile(
        POKEMON_BY_ID.get(pokemonId)!,
        config.development?.[pokemonId],
      ),
      target: targets![slot],
      energy: 100,
      consecutive: 0,
      box: {
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
  return {
    config,
    side,
    players,
    floor: players.slice(0, 5),
    fouls: 0,
    transition: 0,
  };
}

const skill = (p: Player, key: keyof Attributes) =>
  p.profile.attributes[key] * (0.72 + p.energy * 0.0028);
const average = (players: Player[], get: (p: Player) => number) =>
  players.reduce((sum, p) => sum + get(p), 0) / players.length;

function eligiblePlayers(team: Team): Player[] {
  const eligible = team.players.filter((p) => p.box.fouls < 6);
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

function chooseLineup(team: Team, minute: number, close: boolean): void {
  const pool = eligiblePlayers(team),
    chosen: Player[] = [];
  const phase = Math.min(minute / 48, 1);
  for (const role of ROLE_ORDER) {
    let best: Player | undefined,
      bestScore = -Infinity;
    for (const p of pool) {
      if (chosen.includes(p)) continue;
      const foulThreshold =
        minute < 12 ? 2 : minute < 24 ? 3 : minute < 36 ? 4 : 5;
      const foulPenalty =
        minute < 43 && p.box.fouls >= foulThreshold
          ? 14 + (p.box.fouls - foulThreshold) * 9
          : 0;
      const debt = p.target * phase - Math.min(p.box.minutes, 48);
      const score = close
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
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    chosen[role] = best!;
  }
  team.floor = chosen;
}

function replaceFoulOut(team: Team): void {
  const eligible = eligiblePlayers(team);
  team.floor.forEach((p, role) => {
    if (eligible.includes(p)) return;
    const available = eligible.filter(
      (candidate) => !team.floor.includes(candidate),
    );
    available.sort(
      (a, b) =>
        b.profile.positions[POSITIONS[role]] +
        b.energy * 0.25 -
        (a.profile.positions[POSITIONS[role]] + a.energy * 0.25),
    );
    team.floor[role] = available[0];
  });
}

/** One seeded, symmetric game. All points are produced by shots and free throws;
 * there is no synthetic opponent score or post-hoc score correction. */
export function simulateMatch(
  home: LeagueTeam,
  away: LeagueTeam,
  seed: number,
): LeagueMatch {
  const h = buildTeam(home, "home"),
    a = buildTeam(away, "away");
  const result: LeagueMatch = {
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
  let completedPossessions = 0;
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
    replaceFoulOut(defense);
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
  ): boolean => {
    const attack = average(offense.floor, (p) => skill(p, "offensiveRebound"));
    const defend = average(defense.floor, (p) => skill(p, "defensiveRebound"));
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
      pick(offense.floor, (p) => Math.pow(skill(p, "offensiveRebound"), 2)).box
        .offensiveRebounds++;
      return true;
    }
    pick(defense.floor, (p) => Math.pow(skill(p, "defensiveRebound"), 2)).box
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
    if (passer && passer !== shooter && random() < assistChance)
      passer.box.assists++;
  };
  const possession = (offense: Team, defense: Team) => {
    let secondChance = false;
    for (;;) {
      const handler = pick(
        offense.floor,
        (p, role) =>
          Math.pow(
            skill(p, "ballHandling") * 0.45 +
              skill(p, "passing") * 0.35 +
              p.profile.traits.usage * 0.2,
            3,
          ) * (role === 0 ? 1.6 : 1),
      );
      const screener = pick(
        offense.floor.filter((p) => p !== handler),
        (p) => Math.pow(p.profile.traits.screening, 3),
      );
      const tactic = offense.config.tactic;
      const isClutch =
        period >= 3 &&
        periodTicks - tickInPeriod <= 24 &&
        Math.abs(margin(offense)) <= 10;
      const chaseThree =
        isClutch && margin(offense) < -2 && periodTicks - tickInPeriod <= 8;
      const weights = [9 + offense.transition * 25, 30, 17, 17, 27];
      if (tactic === "pace") {
        weights[0] += 23;
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
      if (chaseThree) weights[4] += 45;
      const play = pick(PLAY_TYPES, (_p, i) => weights[i]);
      result.plays[play][offense.side]++;
      offense.transition = 0;
      let shooter: Player;
      if (play === "pickRoll")
        shooter =
          random() < 0.38
            ? screener
            : random() < 0.75
              ? handler
              : pick(offense.floor, (p) => skill(p, "threePoint") ** 3);
      else
        shooter = pick(offense.floor, (p) => {
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
          return rating ** 3;
        });
      const shooterRole = offense.floor.indexOf(shooter);
      let defender = defense.floor[shooterRole];
      if (defense.config.defense === "switch" && play === "pickRoll") {
        defender =
          defense.floor[
            offense.floor.indexOf(shooter === screener ? handler : screener)
          ];
      }
      const shotWeights = [...baseShotMix[play]];
      shotWeights[0] *= clamp(
        1 +
          (skill(shooter, "finishing") - skill(shooter, "threePoint")) * 0.015,
        0.5,
        1.6,
      );
      shotWeights[2] *= clamp(
        1 +
          (skill(shooter, "threePoint") - skill(shooter, "finishing")) * 0.017,
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
      if (chaseThree) shotWeights[2] *= 3;
      const zone = pick<Zone>(
        ["rim", "mid", "three"],
        (_zone, i) => shotWeights[i],
      );
      if (defense.config.defense === "zone" && zone === "rim")
        defender = pick(defense.floor, (p) => skill(p, "interiorDefense") ** 3);
      const pressure = average(
        defense.floor,
        (p) => skill(p, "steal") * 0.5 + skill(p, "perimeterDefense") * 0.5,
      );
      const carrier = play === "post" ? shooter : handler;
      const turnoverRate = clamp(
        0.105 +
          (pressure - skill(carrier, "ballHandling")) * 0.0016 +
          (65 - carrier.profile.traits.decisionMaking) * 0.0005 +
          (defense.config.defense === "press" ? 0.035 : 0) +
          (play === "transition" ? 0.013 : 0) -
          (offense.side === "home" ? 0.004 : 0),
        0.045,
        0.28,
      );
      if (random() < turnoverRate) {
        carrier.box.turnovers++;
        if (random() < 0.64)
          pick(defense.floor, (p) => skill(p, "steal") ** 2).box.steals++;
        defense.transition = 1;
        return;
      }
      // Illegal screens and charges are personal fouls, without defensive bonus FTs.
      if (
        random() <
        (play === "pickRoll" ? 0.012 : 0.007) +
          (70 - carrier.profile.traits.discipline) * 0.00012
      ) {
        const offender = play === "pickRoll" ? screener : carrier;
        offender.box.turnovers++;
        offender.box.fouls++;
        const technical = offender.box.fouls > 6;
        replaceFoulOut(offense);
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
        foul(offense, defense, defender);
        if (defense.fouls >= (period < 4 ? 5 : 4)) {
          if (!freeThrows(offense, defense, carrier, 2)) return;
          secondChance = true;
        }
        continue;
      }
      const spacing = average(
        offense.floor.filter((p) => p !== shooter),
        (p) => skill(p, "threePoint"),
      );
      const protection = average(
        defense.floor,
        (p) => skill(p, "interiorDefense") * 0.6 + skill(p, "block") * 0.4,
      );
      const matchup =
        zone === "rim"
          ? (skill(shooter, "strength") - skill(defender, "strength")) * 0.0006
          : (skill(shooter, "speed") - skill(defender, "speed")) * 0.00045;
      const passer =
        shooter !== handler
          ? handler
          : play === "spotUp" || play === "pickRoll"
            ? pick(
                offense.floor.filter((p) => p !== shooter),
                (p) => skill(p, "passing") ** 2,
              )
            : undefined;
      const passingBonus = passer
        ? (skill(passer, "passing") - 40) *
          (play === "spotUp" ? 0.0009 : 0.00055)
        : 0;
      const screenBonus =
        play === "pickRoll"
          ? (screener.profile.traits.screening - 35) *
            0.0008 *
            (defense.config.defense === "switch" ? 0.4 : 1)
          : 0;
      const coverage =
        defense.config.defense === "zone"
          ? zone === "rim"
            ? -0.035
            : zone === "three"
              ? 0.023
              : 0
          : defense.config.defense === "press"
            ? 0.012
            : defense.config.defense === "switch"
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
      const shootingFoulRate = clamp(
        (zone === "rim" ? 0.16 : zone === "mid" ? 0.075 : 0.035) +
          (shooter.profile.traits.drawFoul -
            defender.profile.traits.discipline) *
            0.0007 +
          (defense.config.defense === "press" ? 0.01 : 0),
        0.015,
        0.25,
      );
      if (random() < shootingFoulRate) {
        const andOne = random() < accuracy * (zone === "rim" ? 0.4 : 0.25);
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
        continue;
      }
      const blocker =
        zone === "rim"
          ? pick(defense.floor, (p) => skill(p, "block") ** 3)
          : defender;
      const blocked =
        random() <
        clamp(
          (zone === "rim" ? 0.052 : zone === "mid" ? 0.021 : 0.009) +
            (skill(blocker, "block") - skill(shooter, "vertical")) *
              (zone === "rim" ? 0.0008 : 0.00025),
          0.003,
          0.14,
        );
      const made = !blocked && random() < accuracy;
      if (blocked) blocker.box.blocks++;
      fieldGoal(offense, defense, shooter, zone, made, passer, assistChance);
      if (made || !rebound(offense, defense)) return;
      secondChance = true;
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
    result.periods.push({ home: 0, away: 0 });
    h.fouls = a.fouls = 0;
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
    for (tickInPeriod = 0; tickInPeriod < periodTicks; tickInPeriod++) {
      if (tickInPeriod % 8 === 0) {
        const close =
          gameMinute >= 44 &&
          Math.abs(result.homeScore - result.awayScore) <= 12;
        if (gameMinute > 0) {
          chooseLineup(h, gameMinute, close);
          chooseLineup(a, gameMinute, close);
        }
        for (const team of [h, a])
          for (const player of team.players) {
            if (team.floor.includes(player)) player.consecutive++;
            else player.consecutive = 0;
          }
        gameMinute++;
      }
      for (const team of [h, a])
        for (const player of team.players) {
          if (team.floor.includes(player)) {
            player.box.minutes += 0.125;
            const drain =
              1.55 +
              (100 - player.profile.attributes.stamina) * 0.025 +
              (team.config.tactic === "pace" ? 0.36 : 0) +
              (team.config.defense === "press" ? 0.4 : 0);
            player.energy = Math.max(25, player.energy - drain * 0.125);
          } else
            player.energy = Math.min(
              100,
              player.energy +
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
      if (random() < possessionRate + rush) {
        possession(offense, defense);
        completedPossessions++;
        offense = defense;
      }
    }
    for (const team of [h, a])
      for (const p of team.players)
        p.energy = Math.min(100, p.energy + (period === 1 ? 12 : 5));
    period++;
  }
  result.possessions = Math.round(completedPossessions / 2);
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
  return result;
}
