import { useState } from "react";
import { COACHES, coachOffers } from "../game/trainerCoaches";
import { TACTIC_LABELS, DEFENSE_LABELS } from "../game/types";
import { CoachPortrait } from "./CoachPortrait";
import "../coaches.css";
export function CoachDraft({
  seed,
  offered = false,
  taken = [],
  manager,
  onChoose,
  disabled = false,
  nextSeason = false,
}: {
  seed: number;
  offered?: boolean;
  taken?: string[];
  manager?: string;
  onChoose: (id: string) => void;
  disabled?: boolean;
  nextSeason?: boolean;
}) {
  const [search, setSearch] = useState("");
  const choices = offered ? coachOffers(seed) : COACHES;
  const visible = choices.filter((c) =>
    `${c.name} ${c.identity} ${c.style}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  return (
    <section className="coach-draft" aria-labelledby="coach-draft-title">
      <div className="coach-draft-heading">
        <div>
          <span className="eyebrow">
            {manager
              ? `${manager}'s turn · Coach draft`
              : nextSeason
                ? "Next season · Head coach"
                : "Before tip-off · Coach draft"}
          </span>
          <h2 id="coach-draft-title">Your team. Their game plan.</h2>
          <p>
            {offered
              ? "Three trainers have answered the call. Draft one to lead your 82–0 run."
              : "Choose your head coach from the available trainers."}{" "}
            They handle starters, minutes, defense and live adjustments
            automatically.
          </p>
        </div>
        <span className="coach-draft-count">
          {offered ? "PICK 1 OF 3" : "32 TRAINERS"}
        </span>
      </div>
      {!offered && (
        <label className="coach-search">
          Find a trainer
          <input
            type="search"
            placeholder="Name, role or coaching style"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      <div className="coach-cards">
        {visible.map((c) => (
          <article
            className={`coach-card${taken.includes(c.id) ? " coach-taken" : ""}`}
            key={c.id}
          >
            <div className="coach-card-top">
              <CoachPortrait coach={c} size="large" />
              <span className="eyebrow">{c.identity}</span>
            </div>
            <h3>{c.name}</h3>
            <strong className="coach-style">{c.style}</strong>
            <p>{c.description}</p>
            <div className="coach-tags">
              <span>{TACTIC_LABELS[c.tactic]}</span>
              <span>{DEFENSE_LABELS[c.defense]}</span>
              <span>
                {c.rotation === "bench"
                  ? "Deep rotation"
                  : c.rotation === "starters"
                    ? "Star workload"
                    : "Balanced workload"}
              </span>
            </div>
            <p className="coach-tradeoff">
              <b>Tradeoff</b> {c.tradeoff}
            </p>
            <button
              className="button primary"
              disabled={disabled || taken.includes(c.id)}
              onClick={() => onChoose(c.id)}
              aria-label={
                taken.includes(c.id)
                  ? `${c.name} already drafted`
                  : `Draft ${c.name}`
              }
            >
              {taken.includes(c.id) ? "Already drafted" : `Draft ${c.name}`}
            </button>
          </article>
        ))}
      </div>
      {!visible.length && <p>No trainers match that search.</p>}
      <p className="coach-footnote">
        Coaches stay with their club until an offseason coaching change. Trainer
        identities come from Pokémon; basketball styles are original to this
        game.{" "}
        <a href="/coaches/credits.html" target="_blank" rel="noreferrer">
          Portrait credits
        </a>
        .{" "}
        {nextSeason &&
          "This choice begins next season; completed results stay unchanged."}
      </p>
    </section>
  );
}
