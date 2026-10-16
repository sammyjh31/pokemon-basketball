import { engineProfile } from "../game/engineDepth";
import type { Pokemon } from "../game/types";

export function DepthScouting({
  mon,
  abilities,
}: {
  mon: Pokemon;
  abilities: boolean;
}) {
  const profile = engineProfile(mon);
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
        <strong>{profile.signature.name}</strong> ·{" "}
        {abilities
          ? profile.signature.description
          : "Signature abilities are disabled in this league."}
      </p>
      <p className="stat-legend">
        These are bounded basketball effects. Skills, matchups, lineup balance,
        and randomness still decide games.
      </p>
    </section>
  );
}
