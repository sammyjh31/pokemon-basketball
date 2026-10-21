import { useShinyPokemon, ShinyBadge } from "./ShinyPokemon";
import { playerPersonality } from "../game/playerPersonality";
import { PersonalityDetails } from "./PersonalityDetails";
import "../morale.css";
import { SpeciesAbility } from "./SpeciesAbility";
import type { DevelopmentRatings } from "../game/developmentTypes";
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
import { TypeScouting } from "./TypeScouting";
import "../typeMatchups.css";
import { Portrait, TypeBadges } from "./Portrait";
import { playerProfile, PROFILE_LABELS } from "../game/playerProfile";

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
export function ScoutReport({
  mon,
  development,
  personalityVersion,
}: {
  mon: Pokemon;
  development?: DevelopmentRatings;
  personalityVersion?: 1;
}) {
  mon = useShinyPokemon(mon);
  const a = attributes(mon, development),
    best = bestPosition(mon, development),
    profile = playerProfile(mon, development);
  const ranked = [...DETAILED_ATTRIBUTE_KEYS].sort((x, y) => a[y] - a[x]);
  const strengths = ranked.slice(0, 3),
    tradeoffs = ranked.slice(-2).reverse();
  return (
    <section
      className="scout-report"
      aria-label={`${mon.name} scouting report`}
    >
      <div className="scout-identity">
        <Portrait mon={mon} />
        <div className="scout-title">
          <span className="eyebrow">
            PLAYER SCOUTING · #{String(mon.id).padStart(3, "0")}
          </span>
          <span className="scout-player-name">{mon.name}</span>
          <strong>{profile.archetype}</strong>
          <ShinyBadge mon={mon} />
        </div>
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
          {Math.round(positionRating(mon, best, development))}
          <small>/100</small>
        </strong>
      </div>
      <div className="scout-positions" aria-label="Position fit ratings">
        {POSITIONS.map((position) => (
          <div key={position} className={position === best ? "best" : ""}>
            <span>{position}</span>
            <strong>
              {Math.round(positionRating(mon, position, development))}
            </strong>
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
      <p className="scout-summary">{profile.scouting}</p>
      <SpeciesAbility pokemonId={mon.id} />
      {personalityVersion === 1 && (
        <section
          className="scout-personality"
          aria-label="Basketball personality"
        >
          <h4>Basketball personality</h4>
          <PersonalityDetails personality={playerPersonality(mon.id)} />
        </section>
      )}
      <details className="scout-details">
        <summary>
          Full scouting report{" "}
          <span>20 skills + 9 advanced tools + source stats</span>
        </summary>
        <div className="scout-details-content">
          <TypeScouting types={mon.types} />
          <h4>Overall skills</h4>
          <SkillRows keys={ATTRIBUTE_KEYS} a={a} />
          {SKILL_GROUPS.map((group) => (
            <div key={group.label}>
              <h4>{group.label}</h4>
              <SkillRows keys={group.keys} a={a} />
            </div>
          ))}
          <section
            className="scout-profile"
            aria-label="Advanced tools and tendencies"
          >
            <h4>Advanced tools and tendencies</h4>
            <dl className="scout-skills scout-advanced">
              {Object.entries(profile.traits).map(([key, value]) => (
                <div key={key}>
                  <dt>{PROFILE_LABELS[key as keyof typeof profile.traits]}</dt>
                  <dd>
                    {Math.round(value)}
                    <span className="scout-skill-track" aria-hidden="true">
                      <i style={{ width: `${value}%` }} />
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="scout-profile-note">
              All values use a 0–100 scale. Scoring initiative describes how
              much offense this player seeks; it works best with teammates who
              complement that role.
            </p>
          </section>
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
