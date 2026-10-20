import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import type { BasketballMove, MoveTeam } from "./moveTypes";
import { signatureMoves, signatureMovesForSpecies } from "./signatureMoves";
export const basketballMoves: readonly BasketballMove[] = [
  {
    id: "quick-attack",
    name: "Quick Attack",
    description:
      "An explosive driving step creates separation, at an energy cost.",
    focus: "conditioning",
    opportunities: ["drive"],
    cost: 5,
    cooldown: 65,
  },
  {
    id: "agility",
    name: "Agility",
    description:
      "Accelerates a drive or off-ball cut for this action sequence.",
    focus: "conditioning",
    opportunities: ["drive", "cut"],
    cost: 4.8,
    cooldown: 80,
  },
  {
    id: "helping-hand",
    name: "Helping Hand",
    description:
      "A controlled pass reduces interception risk and prepares the receiver's next shot.",
    focus: "playmaking",
    opportunities: ["pass"],
    cost: 3.8,
    cooldown: 60,
  },
  {
    id: "protect",
    name: "Protect",
    description:
      "A timed closeout improves position and the contest on this attempt.",
    focus: "defense",
    opportunities: ["defend"],
    cost: 3.5,
    cooldown: 55,
  },
  {
    id: "iron-defense",
    name: "Iron Defense",
    description:
      "Braces a screen or interior contest; strongest on physically powerful players.",
    focus: "position",
    opportunities: ["screen", "defend"],
    cost: 5.5,
    cooldown: 85,
  },
  {
    id: "double-team",
    name: "Double Team",
    description:
      "Deceptive off-ball movement improves a cut or navigation around a screen.",
    focus: "position",
    opportunities: ["cut", "navigate"],
    cost: 4.5,
    cooldown: 70,
  },
  {
    id: "focus-energy",
    name: "Focus Energy",
    description:
      "Composed set-shot preparation improves this attempt, without granting points.",
    focus: "shooting",
    opportunities: ["shoot"],
    cost: 4.5,
    cooldown: 75,
  },
  {
    id: "recover",
    name: "Recover",
    description:
      "Restores energy when tired, scaled by mastery and specialization; uses this sequence's move opportunity.",
    focus: "conditioning",
    opportunities: ["recover"],
    cost: 0,
    cooldown: 150,
  },
];
export const allBasketballMoves = [...basketballMoves, ...signatureMoves];
export const isMovesetVersion = (value: unknown): value is 1 | 2 | 3 | 4 =>
  value === 1 || value === 2 || value === 3 || value === 4;
export function movesEnabled(team: Partial<MoveTeam>) {
  return (
    isMovesetVersion(team.movesetVersion) &&
    team.abilityVersion === 1 &&
    team.abilityMasteryVersion === 1 &&
    team.courtVersion !== undefined &&
    team.engineRules?.abilities !== false
  );
}
export const signaturesEnabled = (team: Partial<MoveTeam>) =>
  team.movesetVersion !== undefined &&
  team.movesetVersion >= 2 &&
  movesEnabled(team);
/** Basketball adaptations, deliberately separate from canonical battle learnsets. */
export function movePool(
  id: number,
  version: 1 | 2 | 3 | 4 = 1,
): BasketballMove[] {
  const mon = POKEMON_BY_ID.get(id);
  if (!mon) return [];
  const a = playerProfile(mon).attributes;
  const basic = basketballMoves.filter((move) => {
    switch (move.id) {
      case "quick-attack":
        return (
          a.speed >= 60 ||
          mon.types.some((t) => ["electric", "flying", "normal"].includes(t))
        );
      case "agility":
        return (
          a.speed >= 65 ||
          mon.types.some((t) => ["electric", "psychic", "flying"].includes(t))
        );
      case "iron-defense":
        return (
          a.strength >= 65 ||
          mon.weightKg >= 90 ||
          mon.types.some((t) => ["steel", "rock", "fighting"].includes(t))
        );
      case "double-team":
        return (
          a.speed >= 62 ||
          mon.types.some((t) => ["ghost", "dark", "bug"].includes(t))
        );
      default:
        return true;
    }
  });
  return version >= 2 ? [...basic, ...signatureMovesForSpecies(id)] : basic;
}
