import { speciesAbility } from "../game/abilities";
import {
  physicalAbilitiesEnabled,
  physicalAbilityDescription,
} from "../game/physicalAbilities";
import { engineProfile } from "../game/engineDepth";
import type { Pokemon } from "../game/types";

export function DepthScouting({
  mon,
  abilities,
  abilityVersion,
  physicalAbilityVersion,
}: {
  mon: Pokemon;
  abilities: boolean;
  abilityVersion?: 1;
  physicalAbilityVersion?: 1;
}) {
  const profile = engineProfile(mon);
  const ability =
    abilityVersion === 1 ? speciesAbility(mon.id) : profile.signature;
  return (
    <section
      className="local-depth-scout"
      aria-label={`${mon.name} engine profile`}
    >
      <h4>Physical profile & playing style</h4>
      <p>
        {mon.heightM} m · {mon.weightKg} kg. Reach helps rim defense and
        rebounding; mass helps screens and contact. Larger bodies also pay
        movement and fatigue costs. Benefits taper off at extreme sizes.
      </p>
      <p>{profile.tendencies.description}</p>
      <p>
        <strong>
          {abilityVersion === 1 ? "Species ability" : "Legacy signature"}:{" "}
          {ability.name}
        </strong>{" "}
        ·{" "}
        {abilities
          ? ability.description
          : abilityVersion === 1
            ? "Species abilities are disabled in this league."
            : "Legacy signature abilities are disabled in this league."}
      </p>
      {physicalAbilitiesEnabled({
        abilityVersion,
        physicalAbilityVersion,
        engineRules: { abilities },
      }) && (
        <p>Physical ability adaptation: {physicalAbilityDescription(mon.id)}</p>
      )}
      <p className="stat-legend">
        These are bounded basketball effects. Skills, matchups, lineup balance,
        and randomness still decide games.
      </p>
    </section>
  );
}
