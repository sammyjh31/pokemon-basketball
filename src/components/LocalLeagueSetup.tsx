import { useState } from "react";
import {
  createLocalLeague,
  LOCAL_TEAMS,
  type LocalLeague,
  type LocalManager,
} from "../game/localLeague";
import { newSeed } from "../hooks/useGame";
import { ALL_POKEMON } from "../data/pokemon";

export function LocalLeagueSetup({
  onStart,
}: {
  onStart: (draft: LocalLeague) => void;
}) {
  const [managers, setManagers] = useState<LocalManager[]>([
    { name: "Friend 1", teamId: 0 },
    { name: "Friend 2", teamId: 1 },
  ]);
  const [legends, setLegends] = useState(false);
  const [error, setError] = useState("");
  const update = (index: number, values: Partial<LocalManager>) =>
    setManagers((current) =>
      current.map((m, i) => (i === index ? { ...m, ...values } : m)),
    );
  return (
    <section
      className="local-panel local-setup"
      aria-labelledby="local-setup-title"
    >
      <div>
        <span className="eyebrow">ONE COMPUTER. EVERY RIVALRY.</span>
        <h2 id="local-setup-title">Who's in your league?</h2>
        <p>
          Pick a team for each friend. The CPU manages the other{" "}
          {30 - managers.length} teams. Pass the computer when it's the next
          friend's turn.
        </p>
        <p>
          Generations I–VII · {ALL_POKEMON.length} Pokémon ·{" "}
          {ALL_POKEMON.filter((p) => legends || !p.legendary).length} eligible.
          New leagues use richer matchup and shot probabilities.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onStart(createLocalLeague(managers, legends, newSeed()));
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Check your league setup.",
            );
          }
        }}
      >
        <div className="local-managers">
          {managers.map((manager, index) => (
            <div className="local-manager-row" key={index}>
              <span className="local-manager-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <label>
                Friend {index + 1} name
                <input
                  required
                  maxLength={24}
                  value={manager.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </label>
              <label>
                Friend {index + 1} team
                <select
                  value={manager.teamId}
                  onChange={(e) =>
                    update(index, { teamId: Number(e.target.value) })
                  }
                >
                  {LOCAL_TEAMS.map((team) => (
                    <option
                      key={team.id}
                      value={team.id}
                      disabled={managers.some(
                        (m, i) => i !== index && m.teamId === team.id,
                      )}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="text-button"
                aria-label={`Remove friend ${index + 1}`}
                disabled={managers.length <= 2}
                onClick={() =>
                  setManagers((current) =>
                    current.filter((_, i) => i !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={managers.length >= 30}
          onClick={() => {
            const teamId = LOCAL_TEAMS.find(
              (t) => !managers.some((m) => m.teamId === t.id),
            )!.id;
            let number = managers.length + 1;
            while (
              managers.some((m) => m.name.toLowerCase() === `friend ${number}`)
            )
              number++;
            setManagers([...managers, { name: `Friend ${number}`, teamId }]);
          }}
        >
          + Add friend
        </button>
        <label className="local-checkbox">
          <input
            type="checkbox"
            checked={legends}
            onChange={(e) => setLegends(e.target.checked)}
          />{" "}
          Include legendary and mythical Pokémon
        </label>
        <div className="local-format">
          <strong>30 teams · 8 rounds · 240 picks</strong>
          <p>
            Every team drafts once per round. The order is randomized once, then
            reverses each round. Each Pokémon belongs to one team.
          </p>
        </div>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" type="submit">
          Start snake draft
        </button>
      </form>
    </section>
  );
}
