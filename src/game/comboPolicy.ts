import { shinyPokemon } from "./shiny";
import { POKEMON_BY_ID } from "../data/pokemon";
import { signaturesEnabled } from "./basketballMoves";
import { comboPlays, type ComboAssignment, type ComboId } from "./comboTypes";
import { playerProfile, type PlayerProfile } from "./playerProfile";
import { pairBond, pairKey } from "./teammateChemistry";
import { getCoach } from "./trainerCoaches";
import type { MoveTeam } from "./moveTypes";
const bounded = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));
const mean = (...ns: number[]) => ns.reduce((n, x) => n + x, 0) / ns.length;
const relayTypes = [
  ["fire", "flying"],
  ["water", "ice"],
  ["electric", "steel"],
  ["grass", "poison"],
  ["psychic", "fighting"],
  ["ghost", "dark"],
  ["rock", "ground"],
  ["dragon", "fairy"],
  ["normal", "bug"],
];
export const combosEnabled = (team: MoveTeam) =>
  signaturesEnabled(team) && team.chemistryVersion === 1;
export function relayPartners(a: number, b: number): boolean {
  const left = POKEMON_BY_ID.get(a),
    right = POKEMON_BY_ID.get(b);
  return (
    !!left &&
    !!right &&
    a !== b &&
    relayTypes.some(
      ([x, y]) =>
        (left.types.includes(x) && right.types.includes(y)) ||
        (left.types.includes(y) && right.types.includes(x)),
    )
  );
}
function roleFit(id: ComboId, a: PlayerProfile, b: PlayerProfile): number {
  const aa = a.attributes,
    ba = b.attributes;
  switch (id) {
    case "pick-roll":
      return mean(
        mean(aa.passing, aa.ballHandling),
        mean(ba.strength, ba.finishing, b.traits.screening),
      );
    case "pick-pop":
      return mean(
        mean(aa.passing, aa.ballHandling),
        mean(ba.threePoint, ba.midRange, b.traits.screening),
      );
    case "drive-kick":
      return mean(
        mean(aa.speed, aa.ballHandling, aa.passing),
        mean(ba.threePoint, b.traits.offBall),
      );
    case "elemental-relay":
      return mean(
        mean(aa.passing, a.traits.decisionMaking),
        mean(ba.finishing, ba.threePoint, b.traits.offBall),
      );
  }
}
function familiarity(team: MoveTeam, a: number, b: number) {
  return team.chemistryGrowthVersion === 1
    ? pairBond(team.chemistryBonds?.[pairKey(a, b)] ?? 0)
    : 0;
}
function players(team: MoveTeam) {
  return Object.values(team.roster).flatMap((id) => {
    const mon = POKEMON_BY_ID.get(id!);
    return mon
      ? [
          {
            id: mon.id,
            profile: playerProfile(
              shinyPokemon(mon, team.shinySeed),
              team.development?.[mon.id],
            ),
            xp: team.abilityMastery?.[mon.id] ?? 0,
          },
        ]
      : [];
  });
}
/** Pure, small playbook. Never calls shared evaluation, training or coachPolicy. */
function rankedCombos(
  team: MoveTeam,
  includeLocked: boolean,
  participant?: number,
): ComboAssignment[] {
  if (!combosEnabled(team)) return [];
  const roster = players(team),
    coach = getCoach(team.coach?.id ?? "");
  return comboPlays
    .flatMap((play) => {
      const options: ComboAssignment[] = [];
      for (const a of roster)
        for (const b of roster) {
          if (
            participant !== undefined &&
            a.id !== participant &&
            b.id !== participant
          )
            continue;
          if (
            a.id === b.id ||
            (play.id === "elemental-relay" && !relayPartners(a.id, b.id))
          )
            continue;
          const mastery = Math.min(a.xp, b.xp),
            unlocked = mastery >= 25;
          if (!includeLocked && !unlocked) continue;
          const bond = familiarity(team, a.id, b.id);
          const chemistry = bounded(
            35 +
              bond * 45 +
              (mean(a.profile.attributes.passing, b.profile.traits.offBall) -
                50) *
                0.3,
          );
          const style =
            (team.tactic === "interior" && play.id === "pick-roll") ||
            (team.tactic === "perimeter" &&
              ["pick-pop", "drive-kick"].includes(play.id)) ||
            (team.tactic === "balanced" && play.id === "elemental-relay") ||
            (team.tactic === "pace" && play.id === "drive-kick")
              ? 12
              : 2;
          const fit = bounded(
            roleFit(play.id, a.profile, b.profile) * 0.63 +
              chemistry * 0.22 +
              Math.min(1000, mastery) * 0.012 +
              style +
              (coach?.adaptability ?? 0.5) * 2,
          );
          options.push({
            id: play.id,
            initiatorId: a.id,
            partnerId: b.id,
            fit,
            chemistry,
            familiarity: bond,
            mastery,
            unlocked,
            reasons: [
              `${coach?.name ?? "Team staff"} favors ${play.name.toLowerCase()} for these players' roles and ${team.tactic} offense.`,
              `Pair mastery ${mastery.toFixed(1)} XP (25 each required); chemistry ${chemistry.toFixed(0)}/100 and earned familiarity ${(bond * 100).toFixed(0)}% shape timing and execution.`,
            ],
          });
        }
      return options
        .sort(
          (a, b) =>
            b.fit - a.fit ||
            a.initiatorId - b.initiatorId ||
            a.partnerId - b.partnerId,
        )
        .slice(0, 2);
    })
    .sort(
      (a, b) =>
        b.fit - a.fit ||
        comboPlays.findIndex((p) => p.id === a.id) -
          comboPlays.findIndex((p) => p.id === b.id) ||
        a.initiatorId - b.initiatorId ||
        a.partnerId - b.partnerId,
    )
    .slice(0, 8);
}
export function coachCombos(
  team: MoveTeam,
  includeLocked = false,
): ComboAssignment[] {
  return rankedCombos(team, includeLocked);
}
/** Incoming projected species/XP, never a roster slot's former player. */
export function comboValue(
  team: MoveTeam,
  id: number,
  profile?: PlayerProfile,
  xp?: number,
): number {
  if (!combosEnabled(team)) return 0;
  const mon = POKEMON_BY_ID.get(id);
  if (!mon) return 0;
  const currentXp = xp ?? team.abilityMastery?.[id] ?? 0;
  if (currentXp < 25) return 0;
  const p =
    profile ??
    playerProfile(shinyPokemon(mon, team.shinySeed), team.development?.[id]);
  let best = 0;
  for (const partner of players(team)) {
    if (partner.id === id || partner.xp < 25) continue;
    const fit = Math.max(
      ...comboPlays
        .filter(
          (play) =>
            play.id !== "elemental-relay" || relayPartners(id, partner.id),
        )
        .map((play) => roleFit(play.id, p, partner.profile)),
    );
    best = Math.max(
      best,
      (fit / 100) * 0.2 +
        familiarity(team, id, partner.id) * 0.12 +
        (Math.min(1000, currentXp, partner.xp) / 1000) * 0.08,
    );
  }
  return bounded(best, 0, 0.4);
}
export function comboTrainingFocus(team: MoveTeam, id: number) {
  const pair = rankedCombos(team, true, id)[0];
  if (!pair) return undefined;
  return comboPlays.find((p) => p.id === pair.id)!.training[
    pair.initiatorId === id ? 0 : 1
  ];
}
