import type { RotationPlan } from "./franchiseFeatures";
import { validateRotationPlan } from "./rotationPlan";
import { teamRatings } from "./ratings";
import { validRoster } from "./lineup";
import {
  TACTICS,
  DEFENSE_SCHEMES,
  ROTATIONS,
  ROSTER_SLOTS,
  type Roster,
  type Tactic,
  type DefenseScheme,
  type RotationStyle,
  type GameState,
} from "./types";
export interface OffseasonRosterSettings {
  roster: Roster;
  tactic: Tactic;
  defense: DefenseScheme;
  rotation: RotationStyle;
  rotationPlan?: RotationPlan;
}

export function updateOffseasonRoster(
  state: GameState,
  settings: OffseasonRosterSettings,
): GameState {
  const franchise = state.franchise;
  if (
    !franchise ||
    franchise.phase !== "offseason" ||
    !settings ||
    !validRoster(settings.roster, state.run.includeLegends, 1025)
  )
    return state;
  const user = franchise.teams[0],
    owned = Object.values(user.roster);
  if (
    !ROSTER_SLOTS.every(
      (slot) =>
        settings.roster[slot] !== null && owned.includes(settings.roster[slot]),
    ) ||
    !TACTICS.includes(settings.tactic) ||
    !DEFENSE_SCHEMES.includes(settings.defense) ||
    !ROTATIONS.includes(settings.rotation)
  )
    return state;
  try {
    const rotationPlan = settings.rotationPlan
      ? validateRotationPlan(settings.rotationPlan)
      : undefined;
    const updated = {
      ...user,
      roster: { ...settings.roster },
      tactic: settings.tactic,
      defense: settings.defense,
      rotation: settings.rotation,
      rotationPlan,
    };
    if (!rotationPlan) delete updated.rotationPlan;
    updated.ratings = teamRatings(
      updated.roster,
      updated.tactic,
      updated.rotation,
      updated.development,
      rotationPlan,
      updated.shinySeed,
    );
    return {
      ...state,
      franchise: {
        ...franchise,
        modelVersion: 3,
        teams: franchise.teams.map((team) => (team.id === 0 ? updated : team)),
      },
    };
  } catch {
    return state;
  }
}
