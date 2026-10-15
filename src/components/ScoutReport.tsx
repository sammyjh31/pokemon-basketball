import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  attributes,
  bestPosition,
  DETAILED_ATTRIBUTE_KEYS,
  positionRating,
} from "../game/ratings";
import {
  POSITIONS,
  POSITION_NAMES,
  type Attributes,
  type Pokemon,
} from "../game/types";
import { TypeBadges } from "./Portrait";

const BASE_LABELS: Record<keyof Pokemon["stats"], string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Attack",
  specialDefense: "Sp. Defense",
  speed: "Speed",
};
const SKILL_GROUPS: { label: string; keys: (keyof Attributes)[] }[] = [
  { label: "Scoring", keys: ["threePoint", "midRange", "freeThrow"] },
  { label: "Creation", keys: ["ballHandling", "passing", "composure"] },
  {
    label: "Athletic tools",
    keys: ["speed", "strength", "stamina", "vertical"],
  },
  {
    label: "Defensive events",
    keys: ["steal", "block", "offensiveRebound", "defensiveRebound"],
  },
];
const TRADEOFFS: Partial<Record<keyof Attributes, string>> = {
  speed: "Less effective in an up-tempo lineup.",
  strength: "Needs stronger teammates against physical interiors.",
  stamina: "Heavy minutes reduce effectiveness.",
  ballHandling: "Pair with a secure primary ball handler.",
  passing: "Better alongside a lead playmaker.",
  composure: "Less reliable under pressure.",
  threePoint: "Pair with floor spacers.",
  midRange: "Less efficient as a midrange option.",
  freeThrow: "Trips to the line offer less value.",
  vertical: "Less explosive above the rim.",
  steal: "Less disruptive in passing lanes.",
  block: "Needs help protecting the rim.",
  offensiveRebound: "Fewer second-chance opportunities.",
  defensiveRebound: "Pair with a strong defensive rebounder.",
};
function archetype(a: Attributes) {
  const profiles: [string, number][] = [
    ["Floor general", 0.65 * a.playmaking + 0.2 * a.speed + 0.15 * a.composure],
    [
      "Perimeter scorer",
      0.65 * a.shooting + 0.2 * a.ballHandling + 0.15 * a.speed,
    ],
    ["Slashing wing", 0.55 * a.finishing + 0.3 * a.speed + 0.15 * a.vertical],
    [
      "Defensive anchor",
      0.6 * a.interiorDefense + 0.25 * a.block + 0.15 * a.rebounding,
    ],
    ["Glass cleaner", 0.7 * a.rebounding + 0.3 * a.strength],
    ["Perimeter stopper", 0.7 * a.perimeterDefense + 0.3 * a.steal],
  ];
  return profiles.sort((x, y) => y[1] - x[1])[0][0];
}
function SkillRows({
  keys,
  a,
}: {
  keys: readonly (keyof Attributes)[];
  a: Attributes;
}) {
  return (
    <dl className="scout-skills">
      {keys.map((key) => (
        <div key={key}>
          <dt>{ATTRIBUTE_LABELS[key]}</dt>
          <dd>
            {Math.round(a[key])}
            <span className="scout-skill-track" aria-hidden="true">
              <i style={{ width: `${a[key]}%` }} />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function ScoutReport({ mon }: { mon: Pokemon }) {
  const a = attributes(mon),
    best = bestPosition(mon);
  const ranked = [...DETAILED_ATTRIBUTE_KEYS].sort((x, y) => a[y] - a[x]);
  const strengths = ranked.slice(0, 3),
    tradeoffs = ranked.slice(-2).reverse();
  return (
    <section
      className="scout-report"
      aria-label={`${mon.name} scouting report`}
    >
      <div className="scout-title">
        <span className="eyebrow">PLAYER SCOUTING</span>
        <strong>{archetype(a)}</strong>
      </div>
      <div className="scout-measurements">
        <TypeBadges types={mon.types} />
        <span>
          {mon.heightM} m · {mon.weightKg} kg
        </span>
      </div>
      <div className="scout-best">
        <span>
          Best fit <b>{POSITION_NAMES[best]}</b>
        </span>
        <strong>
          {Math.round(positionRating(mon, best))}
          <small>/100</small>
        </strong>
      </div>
      <div className="scout-positions" aria-label="Position fit ratings">
        {POSITIONS.map((position) => (
          <div key={position} className={position === best ? "best" : ""}>
            <span>{position}</span>
            <strong>{Math.round(positionRating(mon, position))}</strong>
          </div>
        ))}
      </div>
      <p className="scout-tools">
        <b>Best tools:</b>{" "}
        {strengths
          .map(
            (key) =>
              `${ATTRIBUTE_LABELS[key].toLowerCase()} ${Math.round(a[key])}`,
          )
          .join(" · ")}
      </p>
      <details className="scout-details">
        <summary>
          Full scouting report <span>20 skills + source stats</span>
        </summary>
        <div className="scout-details-content">
          <h4>Overall skills</h4>
          <SkillRows keys={ATTRIBUTE_KEYS} a={a} />
          {SKILL_GROUPS.map((group) => (
            <div key={group.label}>
              <h4>{group.label}</h4>
              <SkillRows keys={group.keys} a={a} />
            </div>
          ))}
          <h4>Roster tradeoffs</h4>
          <ul className="scout-tradeoffs">
            {tradeoffs.map((key) => (
              <li key={key}>
                <b>
                  {ATTRIBUTE_LABELS[key]} · {Math.round(a[key])}
                </b>
                <span>{TRADEOFFS[key]}</span>
              </li>
            ))}
          </ul>
          <h4>Pokémon source stats</h4>
          <dl className="scout-base-stats">
            {Object.entries(BASE_LABELS).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{mon.stats[key as keyof Pokemon["stats"]]}</dd>
              </div>
            ))}
          </dl>
          <p className="scout-footnote">
            Source stats above are Pokémon base stats. Basketball ratings are
            fictional, capped at 100, and include size tradeoffs and small type
            tendencies. Fit measures this player’s role; teammates, coaching and
            minutes affect the team.
          </p>
        </div>
      </details>
    </section>
  );
}
