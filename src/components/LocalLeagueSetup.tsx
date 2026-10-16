import { useState } from "react";
import {
  createLocalLeague,
  LOCAL_TEAMS,
  type LocalLeague,
  type LocalManager,
} from "../game/localLeague";
import { newSeed } from "../hooks/useGame";
import { FRANCHISE_POKEMON } from "../data/pokemon";

export function LocalLeagueSetup({
  onStart,
}: {
  onStart: (draft: LocalLeague) => void;
}) {
  const [managers, setManagers] = useState<LocalManager[]>([
    { name: "Friend 1", teamId: 0 },
    { name: "Friend 2", teamId: 1 },
  ]);
  const [legends, setLegends] = useState(false),
    [error, setError] = useState("");
  const [mode, setMode] = useState<"generational" | "full-pool">(
    "generational",
  );
  const [teamCount, setTeamCount] = useState<4 | 8 | 16 | 30>(8);
  const [gamesPerTeam, setGames] = useState<14 | 28 | 82>(28);
  const [playoffTeams, setPlayoffTeams] = useState<4 | 8 | 16>(8);
  const [bestOf, setBestOf] = useState<1 | 3 | 5 | 7>(3);
  const [abilities, setAbilities] = useState(true),
    [adaptiveCoaching, setAdaptive] = useState(true);
  const update = (index: number, values: Partial<LocalManager>) =>
    setManagers((current) =>
      current.map((m, i) => (i === index ? { ...m, ...values } : m)),
    );
  const resize = (count: 4 | 8 | 16 | 30) => {
    setTeamCount(count);
    setPlayoffTeams((current) => Math.min(current, count) as 4 | 8 | 16);
    setManagers((current) => {
      const taken = new Set<number>();
      return current.map((m) => {
        const id =
          m.teamId < count && !taken.has(m.teamId)
            ? m.teamId
            : LOCAL_TEAMS.slice(0, count).find((t) => !taken.has(t.id))!.id;
        taken.add(id);
        return { ...m, teamId: id };
      });
    });
  };
  const pool = FRANCHISE_POKEMON.filter(
    (p) => (mode === "full-pool" || p.id <= 151) && (legends || !p.legendary),
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
          {teamCount - managers.length} teams. Pass the computer when it's the
          next friend's turn.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onStart(
              createLocalLeague(managers, legends, newSeed(), 2, {
                mode,
                format: { teamCount, gamesPerTeam, playoffTeams, bestOf },
                engineRules: {
                  version: 1,
                  abilities,
                  adaptiveCoaching,
                  familiarity: 0,
                },
              }),
            );
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Check your league setup.",
            );
          }
        }}
      >
        <div className="local-settings">
          <label>
            Franchise progression
            <select
              value={mode}
              onChange={(e) => {
                const next = e.target.value as typeof mode;
                if (next === "generational" && managers.length > 16) {
                  setError(
                    "Generation I supports at most 16 teams. Remove friends before switching modes.",
                  );
                  return;
                }
                setMode(next);
                setError("");
                if (next === "generational" && teamCount > 16) resize(16);
              }}
            >
              <option value="generational">
                Generational · start with Gen I
              </option>
              <option value="full-pool">Full pool · all generations now</option>
            </select>
          </label>
          <label>
            League size
            <select
              value={teamCount}
              onChange={(e) =>
                resize(Number(e.target.value) as typeof teamCount)
              }
            >
              {([4, 8, 16, 30] as const)
                .filter((n) => mode === "full-pool" || n <= 16)
                .map((n) => (
                  <option value={n} key={n} disabled={n < managers.length}>
                    {n} teams
                  </option>
                ))}
            </select>
          </label>
          <label>
            Games per team
            <select
              value={gamesPerTeam}
              onChange={(e) =>
                setGames(Number(e.target.value) as typeof gamesPerTeam)
              }
            >
              {[14, 28, 82].map((n) => (
                <option key={n} value={n}>
                  {n} games
                </option>
              ))}
            </select>
          </label>
          <label>
            Playoff qualifiers
            <select
              value={playoffTeams}
              onChange={(e) =>
                setPlayoffTeams(Number(e.target.value) as typeof playoffTeams)
              }
            >
              {[4, 8, 16]
                .filter((n) => n <= teamCount)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} teams qualify
                  </option>
                ))}
            </select>
          </label>
          <label>
            Playoff series
            <select
              value={bestOf}
              onChange={(e) =>
                setBestOf(Number(e.target.value) as typeof bestOf)
              }
            >
              {[1, 3, 5, 7].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Single elimination" : `Best of ${n}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="stat-legend">
          {mode === "generational"
            ? "Start with Generation I. Each offseason introduces the next generation in a two-round rookie draft, through Gen IX. The Gen I pool supports up to 16 unique eight-player teams."
            : "Generations I–IX are available in the opening draft. Keep building your team through development and player trades; future seasons have no rookie draft."}{" "}
          Both modes keep your friends' teams and championship history.
        </p>
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
                  {LOCAL_TEAMS.slice(0, teamCount).map((team) => (
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
          disabled={managers.length >= teamCount}
          onClick={() => {
            const teamId = LOCAL_TEAMS.slice(0, teamCount).find(
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
        <label className="local-checkbox">
          <input
            type="checkbox"
            checked={abilities}
            onChange={(e) => setAbilities(e.target.checked)}
          />{" "}
          Signature abilities
        </label>
        <label className="local-checkbox">
          <input
            type="checkbox"
            checked={adaptiveCoaching}
            onChange={(e) => setAdaptive(e.target.checked)}
          />{" "}
          Adaptive CPU coaching
        </label>
        <p className="stat-legend">
          Signature abilities add small situational bonuses. Physical matchups,
          player tendencies and complementary lineups also affect new leagues.
        </p>
        <div className="local-format">
          <strong>
            {teamCount} teams · 8 rounds · {teamCount * 8} picks
          </strong>
          <p>
            {pool.length} eligible Pokémon. Every team drafts once per round.
            The randomized order reverses each round. Each Pokémon belongs to
            one team.
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
