import type { PlayerPersonality } from "../game/playerPersonality";

/** Accept the recorded profile so historical reports never consult current teams. */
export function PersonalityDetails({
  personality,
}: {
  personality: PlayerPersonality;
}) {
  const traits = [
    "ambition",
    "loyalty",
    "resilience",
    "coachability",
    "leadership",
  ] as const;
  return (
    <div className="personality-details">
      <p>
        <strong>{personality.archetype}</strong> · {personality.leadershipStyle}
        . {personality.description}
      </p>
      <dl className="morale-factors personality-traits">
        {traits.map((trait) => (
          <div key={trait}>
            <dt>{trait[0].toUpperCase() + trait.slice(1)}</dt>
            <dd>{personality[trait]} / 100</dd>
          </div>
        ))}
      </dl>
      <p>
        Ambition shapes minutes expectations and responses to results. Loyalty
        shapes transition stress; resilience helps recovery. Coachability
        changes how the trainer’s approach lands. Leadership informs automatic
        captain selection.
      </p>
      <p className="morale-note">
        A stable basketball adaptation of this Pokémon. Traits bring different
        needs and tradeoffs; they do not change base ratings.
      </p>
    </div>
  );
}
