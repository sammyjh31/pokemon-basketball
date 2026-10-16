import { TYPE_CHART } from "../data/typeChart";
import { typeMatchup } from "../game/typeMatchups";
import { TypeBadges } from "./Portrait";

export function TypeScouting({ types }: { types: string[] }) {
  const all = Object.keys(TYPE_CHART);
  const groups = [
    {
      label: "Attacking coverage",
      types: all.filter((type) => typeMatchup(types, [type]).edge > 0),
    },
    {
      label: "Resists",
      types: all.filter((type) => typeMatchup([type], types).edge < 0),
    },
    {
      label: "Watch out for",
      types: all.filter((type) => typeMatchup([type], types).edge > 0),
    },
  ];
  return (
    <section className="type-scouting" aria-label="Type scouting">
      <h4>Type matchups</h4>
      {groups.map((group) => (
        <div key={group.label}>
          <strong>{group.label}</strong>
          {group.types.length ? (
            <TypeBadges types={group.types} />
          ) : (
            <span>None</span>
          )}
        </div>
      ))}
      <p>
        Coverage shows single-type opponents. Both defending types apply in a
        real matchup. Resistances soften scoring and pressure; they never
        guarantee a stop.
      </p>
    </section>
  );
}
