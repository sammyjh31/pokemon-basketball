import { POKEMON_BY_ID } from "../../data/pokemon";
import {
  chemistryEnabled,
  evaluateLineupChemistry,
  NEUTRAL_CHEMISTRY_EFFECTS,
  type ChemistryContext,
  type ChemistryPlayer,
} from "../lineupChemistry";
import { playerProfile } from "../playerProfile";
import { activePlayers } from "./helpers";
import type { ArcadePlayer, ArcadeState, Side } from "./types";

function chemistryPlayers(players: readonly ArcadePlayer[]): ChemistryPlayer[] {
  return players.map((p) => ({
    pokemonId: p.pokemonId,
    profile: {
      ...(p.chemistryProfile ?? playerProfile(POKEMON_BY_ID.get(p.pokemonId)!)),
      attributes: p.attributes,
    },
  }));
}

function context(s: ArcadeState, side: Side): ChemistryContext {
  return {
    tactic: "balanced",
    defense: "man",
    ...s.chemistryContexts?.[side],
    abilities: s.abilityVersion === 1,
  };
}

/** Candidate units are evaluated without changing the live five or its cache. */
export function evaluateArcadeLineup(
  s: ArcadeState,
  side: Side,
  players: readonly ArcadePlayer[],
) {
  return evaluateLineupChemistry(chemistryPlayers(players), context(s, side));
}

/** Only the actual active five contribute, including when a direct caller changes them. */
export function refreshArcadeChemistry(s: ArcadeState) {
  if (!chemistryEnabled(s)) return;
  const next = ([0, 1] as const).map((side) => {
    const players = activePlayers(s, side);
    // Attributes normally remain frozen in play. Include them so practice/custom
    // callers cannot retain stale effects after deliberately changing a rating.
    const key = JSON.stringify([
      context(s, side),
      players.map((p) => [
        p.id,
        p.pokemonId,
        p.attributes,
        p.chemistryProfile?.traits,
      ]),
    ]);
    const cached = s.chemistryLineups?.[side];
    return cached?.key === key
      ? cached
      : { key, lineup: evaluateArcadeLineup(s, side, players) };
  }) as NonNullable<ArcadeState["chemistryLineups"]>;
  s.chemistryLineups = next;
}

export function arcadeLineupChemistry(s: ArcadeState, side: Side) {
  refreshArcadeChemistry(s);
  return chemistryEnabled(s) ? s.chemistryLineups?.[side].lineup : undefined;
}

export function arcadeChemistryEffects(s: ArcadeState, p: ArcadePlayer) {
  if (!p.active || !chemistryEnabled(s)) return NEUTRAL_CHEMISTRY_EFFECTS;
  return (
    arcadeLineupChemistry(s, p.team)?.effects[p.pokemonId] ??
    NEUTRAL_CHEMISTRY_EFFECTS
  );
}
