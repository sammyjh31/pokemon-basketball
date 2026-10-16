import { bodyProfile, previewBodyShot } from "../game/bodyMatchups";
import { useState } from "react";
import { FRANCHISE_POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "../game/playerProfile";
import { evaluateShot, type ShotZone } from "../game/shotModel";
import {
  DEFENSE_LABELS,
  DEFENSE_SCHEMES,
  POSITIONS,
  type DefenseScheme,
  type Position,
  type PlayType,
} from "../game/types";
import { typeMatchup, typeMatchupLabel } from "../game/typeMatchups";
import { Portrait } from "./Portrait";
import "../teamAnalytics.css";
import "../typeMatchups.css";

export function MatchupLab() {
  const [open, setOpen] = useState(false),
    [shooter, setShooter] = useState(65),
    [defender, setDefender] = useState(143);
  const [zone, setZone] = useState<ShotZone>("three"),
    [play, setPlay] = useState<PlayType>("spotUp"),
    [coverage, setCoverage] = useState<DefenseScheme>("man");
  const [energy, setEnergy] = useState(100),
    [spacing, setSpacing] = useState(55),
    [position, setPosition] = useState<Position>("PG");
  const a = POKEMON_BY_ID.get(shooter)!,
    b = POKEMON_BY_ID.get(defender)!,
    ap = playerProfile(a),
    bp = playerProfile(b);
  const baseShot = evaluateShot({
    resolvedMatchup: true,
    shooter: ap,
    defender: bp,
    shooterHeight: a.heightM,
    defenderHeight: b.heightM,
    zone,
    play,
    coverage,
    shooterEnergy: energy,
    spacing,
    roleFitPenalty:
      Math.max(...Object.values(ap.positions)) - ap.positions[position],
  });
  const body = previewBodyShot(
    baseShot.probability,
    { body: bodyProfile(a), profile: ap, types: a.types, energy },
    { body: bodyProfile(b), profile: bp, types: b.types, energy: 100 },
    { play, zone, coverage },
  );
  const shot = {
    ...baseShot,
    probability: body.probability,
    factors: [
      ...baseShot.factors,
      { label: "Physical contest", change: body.physicalChange },
      { label: "Type matchup", change: body.typeChange },
    ],
  };
  const type = typeMatchup(a.types, b.types);
  return (
    <section className="matchup-lab local-panel" aria-label="Matchup explorer">
      <div className="results-section-heading">
        <div>
          <span className="eyebrow">LEARN BEFORE YOU DRAFT</span>
          <h3>Matchup explorer</h3>
          <p>
            Explore how body, typing and skill interact against a specific
            defender. This preview uses the same physical contests as new
            simulated games.
          </p>
        </div>
        <button
          className="button secondary"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Close matchup explorer" : "Open matchup explorer"}
        </button>
      </div>
      {open && (
        <>
          <div className="league-controls">
            <label className="league-field">
              Shooter
              <select
                value={shooter}
                onChange={(e) => {
                  setShooter(Number(e.target.value));
                  setPosition(
                    playerProfile(POKEMON_BY_ID.get(Number(e.target.value))!)
                      .bestPosition,
                  );
                }}
              >
                {FRANCHISE_POKEMON.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Defender
              <select
                value={defender}
                onChange={(e) => setDefender(Number(e.target.value))}
              >
                {FRANCHISE_POKEMON.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Shot location
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value as ShotZone)}
              >
                <option value="rim">At the rim</option>
                <option value="mid">Midrange</option>
                <option value="three">Three-pointer</option>
              </select>
            </label>
            <label className="league-field">
              Play type
              <select
                value={play}
                onChange={(e) => setPlay(e.target.value as PlayType)}
              >
                <option value="spotUp">Spot-up</option>
                <option value="pickRoll">Pick &amp; roll</option>
                <option value="isolation">Isolation</option>
                <option value="post">Post-up</option>
                <option value="transition">Transition</option>
              </select>
            </label>
            <label className="league-field">
              Defensive coverage
              <select
                value={coverage}
                onChange={(e) => setCoverage(e.target.value as DefenseScheme)}
              >
                {DEFENSE_SCHEMES.map((d) => (
                  <option key={d} value={d}>
                    {DEFENSE_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Shooter position
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as Position)}
              >
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Shooter energy
              <input
                aria-label="Shooter energy"
                type="range"
                min="0"
                max="100"
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
              />
              <span>{energy}/100</span>
            </label>
            <label className="league-field">
              Teammate spacing
              <input
                aria-label="Teammate spacing"
                type="range"
                min="0"
                max="100"
                value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
              />
              <span>{spacing}/100</span>
            </label>
          </div>
          <div className="analysis-cards">
            {[
              [a, ap],
              [b, bp],
            ].map(([mon, profile], i) => {
              const p = mon as typeof a,
                info = profile as typeof ap;
              return (
                <article key={i}>
                  <Portrait mon={p} />
                  <span className="eyebrow">
                    {i ? "Defender" : "Shooter"} · {p.types.join(" / ")}
                  </span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.heightM} m · {p.weightKg} kg · {info.archetype}
                  </small>
                  <p>
                    3PT {info.attributes.threePoint.toFixed(0)} · FIN{" "}
                    {info.attributes.finishing.toFixed(0)} · SPD{" "}
                    {info.attributes.speed.toFixed(0)} · STR{" "}
                    {info.attributes.strength.toFixed(0)} · PER D{" "}
                    {info.attributes.perimeterDefense.toFixed(0)} · INT D{" "}
                    {info.attributes.interiorDefense.toFixed(0)}
                  </p>
                </article>
              );
            })}
          </div>
          <section className="type-matchup-insight" aria-label="Type matchup">
            <span className="eyebrow">
              {type.attackType ?? "Neutral"} attack · {b.types.join(" / ")}{" "}
              defense
            </span>
            <strong>{typeMatchupLabel(type)}</strong>
            <p>
              Dual-type players use their stronger attacking type. Both
              defending types count. A type advantage modestly raises shot odds;
              resistance lowers them. Even an immunity leaves a playable
              basketball matchup.
            </p>
          </section>
          <section
            className="type-matchup-insight"
            aria-label="Physical matchup"
          >
            <strong>Who creates the mismatch?</strong>
            <p>
              Post leverage:{" "}
              {body.edges.contact > 0.04
                ? a.name
                : body.edges.contact < -0.04
                  ? b.name
                  : "even"}
              . Reach edge:{" "}
              {body.edges.reach > 0.04
                ? a.name
                : body.edges.reach < -0.04
                  ? b.name
                  : "even"}
              . Turning / first-step edge:{" "}
              {body.edges.quickness > 0.04
                ? a.name
                : body.edges.quickness < -0.04
                  ? b.name
                  : "even"}
              .
            </p>
            <p>
              <output aria-label="Advantage creation chance">
                {(body.advantageChance * 100).toFixed(1)}%
              </output>{" "}
              chance to create{" "}
              {play === "post" && zone === "rim"
                ? "a deep post seal"
                : "separation"}{" "}
              with this action.
            </p>
            <p>
              If the attack wins position:{" "}
              {(body.wonProbability * 100).toFixed(1)}% shot chance. If
              contained: {(body.containedProbability * 100).toFixed(1)}%. The
              overall preview averages both outcomes.
            </p>
            <small>
              Mass provides contact and screen leverage, but increases turning
              costs and fatigue. Reach helps contests and short rebounds; quick
              players can attack a heavy defender in space. Type advantage also
              changes the contest itself.
            </small>
          </section>
          <output aria-label="Shot make probability">
            {(shot.probability * 100).toFixed(1)}%
          </output>
          <p className="stat-legend">
            Make probability before blocks and shooting fouls. Neutral home
            court, fresh defender, average help defense, and no passing or
            screening advantage. A real game supplies its current lineups and
            context; this is a controlled scenario, not a predicted game score.
          </p>
          <div className="probability-factors">
            <span>
              Base shot chance<b>{(shot.baseProbability * 100).toFixed(1)}%</b>
            </span>
            {shot.factors
              .filter((f) => Math.abs(f.change) > 0.00005)
              .map((f) => (
                <span key={f.label}>
                  {f.label}
                  <b>
                    {f.change >= 0 ? "+" : ""}
                    {(f.change * 100).toFixed(1)} pp
                  </b>
                </span>
              ))}
          </div>
          <p className="stat-legend">
            Changes apply in this order and add to the displayed probability.
            Pokémon types affect skills and the matchup shown above. Type
            effects are strongest at the rim; help defenders can soften them in
            games. Catalog dimensions are smoothly compressed into basketball
            reach and leverage; they are not measured standing reach. Extreme
            size never guarantees a basket. The preview uses the newest matchup
            rules; archived games keep their saved rules. Coefficients are game
            tuning, not a model fitted to real-world results.
          </p>
        </>
      )}
    </section>
  );
}
