import {
  abilityImpact,
  addAbilityActivation,
  recordPhysicalAbility,
  type AbilityContext,
  type AbilityRole,
} from "../abilities";
import {
  abilityEnergyChange,
  physicalAbilitiesEnabled,
} from "../physicalAbilities";
import type { ArcadePlayer, ArcadeState } from "./types";
import { clamp, distance, other } from "./helpers";
import { arcadeChemistryEffects } from "./chemistry";

/** Apply energy at its actual resolution point so caps cannot invent savings. */
export function changeArcadeEnergy(
  state: ArcadeState,
  player: ArcadePlayer,
  delta: number,
) {
  const result = abilityEnergyChange(
    player.pokemonId,
    player.energy,
    delta < 0 ? delta * arcadeChemistryEffects(state, player).drain : delta,
    physicalAbilitiesEnabled(state),
    0,
    state.abilityMasteryVersion === 1 ? player.masteryXp : undefined,
  );
  player.energy = result.energy;
  if (result.saved > 0)
    recordPhysicalAbility(player.stats, "energySaved", result.saved);
}

/** Shot-release context comes only from completed actions and current court state. */
export function applyArcadeAbilities(
  state: ArcadeState,
  shooter: ArcadePlayer,
  defender: ArcadePlayer | undefined,
  zone: AbilityContext["zone"],
  chance: number,
): number {
  if (state.abilityVersion !== 1) return chance;
  const contested = !!defender && distance(shooter, defender) < 2.3;
  const lastPass = state.lastPass;
  const candidate =
    lastPass && state.players.find((player) => player.id === lastPass.from);
  const passer =
    lastPass &&
    candidate?.active &&
    candidate.team === shooter.team &&
    candidate.id !== shooter.id &&
    lastPass.to === shooter.id &&
    state.elapsed >= lastPass.time &&
    state.elapsed - lastPass.time <= 3
      ? candidate
      : undefined;
  const transitionAt = state.abilityPossession?.transitionAt;
  const transition =
    transitionAt != null &&
    state.elapsed >= transitionAt &&
    state.elapsed - transitionAt <= 3;
  const context: AbilityContext = {
    zone,
    play: transition
      ? "transition"
      : passer && zone !== "rim" && Math.hypot(shooter.vx, shooter.vy) < 1.5
        ? "spotUp"
        : zone === "rim"
          ? "post"
          : "isolation",
    contested,
    energy: shooter.energy,
    clutch:
      state.period >= 4 &&
      state.clock <= 15 &&
      Math.abs(state.score[0] - state.score[1]) <= 6,
    secondChance: state.abilityPossession?.secondChance === true,
    period: state.period,
    margin: state.score[shooter.team] - state.score[other(shooter.team)],
  };
  const apply = (player: ArcadePlayer, role: AbilityRole) => {
    const delta = abilityImpact(
      player.pokemonId,
      role,
      {
        ...context,
        energy: player.energy,
        margin: state.score[player.team] - state.score[other(player.team)],
      },
      state.abilityMasteryVersion === 1 ? player.masteryXp : undefined,
    );
    const adjusted = clamp(chance + delta, 0.04, 0.95);
    if (adjusted !== chance) addAbilityActivation(player.stats, role);
    chance = adjusted;
  };
  apply(shooter, "shooter");
  if (passer) apply(passer, "passer");
  if (contested && defender) apply(defender, "defender");
  return chance;
}
