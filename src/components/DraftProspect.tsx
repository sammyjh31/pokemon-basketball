import type { CSSProperties } from "react";
import type { DraftRecommendation } from "../game/draftAdvice";
import { engineProfile } from "../game/engineDepth";
import { playerProfile } from "../game/playerProfile";
import {
  POSITION_NAMES,
  type Attributes,
  type Pokemon,
  type Position,
} from "../game/types";
import { Portrait, TypeBadges, TYPE_COLORS } from "./Portrait";
import type { RankedDraftImpact } from "../game/draftImpact";
import type { RosterSlot } from "../game/types";
import { draftImpactChangeLabel } from "./draftImpactFormat";

// Use actual engine attributes, with concrete basketball meanings, rather than
// inventing an overall grade or presenting a rating as a shooting percentage.
export const DRAFT_TOOLS = [
  {
    key: "threePoint",
    label: "Three-point shooting",
    helps: "Stretches the defense",
    tradeoff: "Pair with a shooter to keep the floor spaced.",
  },
  {
    key: "finishing",
    label: "Finishing",
    helps: "Scores around the basket",
    tradeoff: "Needs teammates who can score at the rim.",
  },
  {
    key: "passing",
    label: "Passing",
    helps: "Creates shots for teammates",
    tradeoff: "Pair with a lead playmaker.",
  },
  {
    key: "perimeterDefense",
    label: "Perimeter defense",
    helps: "Challenges outside scorers",
    tradeoff: "Needs help containing perimeter scorers.",
  },
  {
    key: "interiorDefense",
    label: "Interior defense",
    helps: "Protects the paint",
    tradeoff: "Pair with a strong rim defender.",
  },
  {
    key: "rebounding",
    label: "Rebounding",
    helps: "Wins extra possessions",
    tradeoff: "Needs a teammate who can control the boards.",
  },
  {
    key: "speed",
    label: "Speed",
    helps: "Runs the floor",
    tradeoff: "Less suited to a fast-paced lineup.",
  },
  {
    key: "stamina",
    label: "Stamina",
    helps: "Sustains longer shifts",
    tradeoff: "Plan for shorter shifts and reliable reserves.",
  },
] as const satisfies readonly {
  key: keyof Attributes;
  label: string;
  helps: string;
  tradeoff: string;
}[];

export function prospectTools(mon: Pokemon) {
  const { attributes } = playerProfile(mon);
  return [...DRAFT_TOOLS].sort((a, b) => attributes[b.key] - attributes[a.key]);
}

export function DraftToolBars({ mon }: { mon: Pokemon }) {
  const { attributes } = playerProfile(mon);
  return (
    <dl className="draft-tool-bars">
      {DRAFT_TOOLS.map(({ key, label }) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>
            {Math.round(attributes[key])}
            <span aria-hidden="true">
              <i style={{ width: `${attributes[key]}%` }} />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DraftProspectCard({
  mon,
  advice,
  selected,
  compared,
  compareFull,
  rankPosition,
  teamImpact,
  onSelect,
  onCompare,
}: {
  mon: Pokemon;
  advice: DraftRecommendation;
  selected: boolean;
  compared: boolean;
  compareFull: boolean;
  rankPosition: Position | "best" | "fit";
  teamImpact?: {
    entry: RankedDraftImpact;
    slot: RosterSlot;
    poolSize: number;
    bestOpen?: boolean;
    lineup?: boolean;
  };
  onSelect: () => void;
  onCompare: () => void;
}) {
  const profile = playerProfile(mon),
    tools = prospectTools(mon),
    weakest = tools[tools.length - 1];
  const position = teamImpact
    ? teamImpact.slot.startsWith("B")
      ? profile.bestPosition
      : (teamImpact.slot as Position)
    : rankPosition === "fit"
      ? advice.slot.startsWith("B")
        ? profile.bestPosition
        : (advice.slot as Position)
      : rankPosition === "best"
        ? profile.bestPosition
        : rankPosition;
  const caption = teamImpact
    ? teamImpact.slot.startsWith("B")
      ? `${teamImpact.slot} bench fit`
      : "position fit"
    : rankPosition === "fit"
      ? advice.slot.startsWith("B")
        ? "bench fit"
        : "open-role fit"
      : rankPosition === "best"
        ? "best position"
        : "position fit";
  return (
    <article
      className={`draft-prospect ${selected ? "is-selected" : ""}`}
      aria-label={`${mon.name} draft prospect`}
      style={{ "--type-color": TYPE_COLORS[mon.types[0]] } as CSSProperties}
    >
      <div className="draft-prospect-top">
        <span>#{String(mon.id).padStart(3, "0")}</span>
        <span>
          {position} · {caption}{" "}
          <b>{Math.round(profile.positions[position])}</b>
        </span>
      </div>
      <button
        className="draft-prospect-select"
        aria-label={`View scouting for ${mon.name}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="draft-prospect-portrait">
          <Portrait mon={mon} />
        </span>
        <span className="draft-prospect-name">
          {mon.name}
          {mon.legendary && <span aria-label="Legendary or mythical"> ✦</span>}
        </span>
        <span className="draft-archetype">{profile.archetype}</span>
        <span className="draft-card-cta">
          {selected ? "Scouting now ✓" : "View scouting →"}
        </span>
      </button>
      <TypeBadges types={mon.types} />
      {teamImpact && (
        <div className="draft-card-impact">
          <span className="draft-impact-rank">
            Rank {teamImpact.entry.rank}
            {teamImpact.entry.tied ? " (tied)" : ""} of {teamImpact.poolSize}
          </span>
          <p>
            {teamImpact.lineup
              ? "Best lineup found: "
              : teamImpact.bestOpen
                ? "Best open position: "
                : "Projected at "}
            {teamImpact.slot}
          </p>
          <p>{teamImpact.entry.metric.label}</p>
          <strong
            className={
              (teamImpact.entry.metric.delta ?? 0) > 0
                ? "gain"
                : (teamImpact.entry.metric.delta ?? 0) < 0
                  ? "loss"
                  : ""
            }
          >
            {draftImpactChangeLabel(teamImpact.entry.metric.delta)}
            {teamImpact.entry.metric.delta !== null && (
              <small>
                {teamImpact.lineup ? " vs rearranged baseline" : " vs now"}
              </small>
            )}
          </strong>
          <span className="draft-impact-projected">
            {teamImpact.entry.metric.after.toFixed(1)} projected / 100
          </span>
        </div>
      )}
      <div className="draft-card-tools">
        <span className="eyebrow">Best tools</span>
        {tools.slice(0, 2).map((tool) => (
          <p key={tool.key}>
            <span>{tool.label}</span>
            <b>{Math.round(profile.attributes[tool.key])}</b>
          </p>
        ))}
      </div>
      <p className="draft-card-tradeoff">
        <b>Tradeoff · {weakest.label}</b>
        {weakest.tradeoff}
      </p>
      <button
        className="draft-compare-toggle"
        aria-label={`Compare ${mon.name}`}
        aria-pressed={compared}
        disabled={compareFull && !compared}
        onClick={onCompare}
      >
        {compared ? "✓ In comparison" : "+ Compare"}
      </button>
    </article>
  );
}

export function DraftComparison({
  mons,
  advice,
  position,
  abilities,
  onPosition,
  onScout,
}: {
  mons: Pokemon[];
  advice: Map<number, DraftRecommendation>;
  position: Position;
  abilities: boolean;
  onPosition: (position: Position) => void;
  onScout: (id: number) => void;
}) {
  const profiles = mons.map((mon) => playerProfile(mon));
  const numericRow = (label: string, values: number[], note?: string) => (
    <tr key={label}>
      <th scope="row">
        {label}
        {note && <small>{note}</small>}
      </th>
      {values.map((value, i) => (
        <td key={mons[i].id}>
          <span
            className={`draft-compare-number ${Math.round(value) === Math.max(...values.map(Math.round)) ? "is-leading" : ""}`}
          >
            {Math.round(value)}
          </span>
        </td>
      ))}
    </tr>
  );
  return (
    <div className="draft-comparison">
      <label>
        Compare at the same position
        <select
          value={position}
          onChange={(e) => onPosition(e.target.value as Position)}
        >
          {Object.entries(POSITION_NAMES).map(([key, name]) => (
            <option value={key} key={key}>
              {key} · {name}
            </option>
          ))}
        </select>
      </label>
      <p>
        Ratings use a 0–100 scale, not success percentages. Highlighted ratings
        lead this shortlist, including ties. Size alone does not decide a
        matchup.
      </p>
      <p className="draft-compare-hint">
        Swipe or scroll sideways to see every player.
      </p>
      <div
        className="draft-comparison-scroll"
        role="region"
        aria-label="Scrollable player comparison"
        tabIndex={0}
      >
        <table aria-label="Pokémon draft comparison">
          <thead>
            <tr>
              <th scope="col">Scouting</th>
              {mons.map((mon) => (
                <th scope="col" key={mon.id}>
                  <Portrait mon={mon} />
                  <strong>{mon.name}</strong>
                  <button
                    className="text-button"
                    onClick={() => onScout(mon.id)}
                  >
                    Scout {mon.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numericRow(
              `${position} fit`,
              profiles.map((p) => p.positions[position]),
              POSITION_NAMES[position],
            )}
            <tr>
              <th scope="row">Role on your roster</th>
              {mons.map((mon) => (
                <td key={mon.id}>
                  {advice.get(mon.id)!.slot} · {playerProfile(mon).archetype}
                </td>
              ))}
            </tr>
            {DRAFT_TOOLS.map((tool) =>
              numericRow(
                tool.label,
                profiles.map((p) => p.attributes[tool.key]),
                tool.helps,
              ),
            )}
            <tr>
              <th scope="row">Size</th>
              {mons.map((mon) => (
                <td key={mon.id}>
                  {mon.heightM} m · {mon.weightKg} kg
                </td>
              ))}
            </tr>
            {abilities && (
              <tr>
                <th scope="row">Signature ability</th>
                {mons.map((mon) => (
                  <td key={mon.id}>
                    <strong>{engineProfile(mon).signature.name}</strong>
                    <small>{engineProfile(mon).signature.description}</small>
                  </td>
                ))}
              </tr>
            )}
            <tr>
              <th scope="row">Tradeoff</th>
              {mons.map((mon) => (
                <td key={mon.id}>{prospectTools(mon).at(-1)!.tradeoff}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
