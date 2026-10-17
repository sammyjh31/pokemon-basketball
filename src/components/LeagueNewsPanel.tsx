import { useMemo, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { LeagueNewsCategory, LeagueNewsStory } from "../game/leagueNews";
import "../leagueNews.css";
const labels: Record<LeagueNewsCategory, string> = {
  games: "Games",
  development: "Development",
  transactions: "Transactions",
  honors: "Honors & coaching",
};
export function LeagueNewsPanel({
  stories,
  yourTeamIds = [0],
  onPlayer,
  onGame,
  canOpenGame,
}: {
  stories: LeagueNewsStory[];
  yourTeamIds?: number[];
  onPlayer?: (pokemonId: number, year: number) => void;
  onGame?: (gameId: string, year: number) => void;
  canOpenGame?: (gameId: string, year: number) => boolean;
}) {
  const years = useMemo(
    () => [...new Set(stories.map((s) => s.year))].sort((a, b) => b - a),
    [stories],
  );
  const [selectedYear, setYear] = useState<number | null>(null),
    [category, setCategory] = useState("all"),
    [onlyYours, setOnlyYours] = useState(false),
    [visible, setVisible] = useState(30);
  const year =
    selectedYear !== null && years.includes(selectedYear)
      ? selectedYear
      : years[0];
  const filtered = stories.filter(
    (s) =>
      s.year === year &&
      (category === "all" || s.category === category) &&
      (!onlyYours || s.teamIds.some((id) => yourTeamIds.includes(id))),
  );
  return (
    <section className="league-news" aria-label="League news">
      <div className="franchise-section-heading">
        <div>
          <span className="eyebrow">AROUND THE LEAGUE</span>
          <h3>League news</h3>
          <p>
            Results, player growth and club moves from the league’s recorded
            history.
          </p>
        </div>
      </div>
      <div className="league-controls news-controls">
        <label className="league-field">
          News season
          <select
            value={year ?? ""}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setVisible(30);
            }}
            disabled={!years.length}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </label>
        <label className="league-field">
          News category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setVisible(30);
            }}
          >
            <option value="all">All stories</option>
            {Object.entries(labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="news-team-filter">
          <input
            type="checkbox"
            checked={onlyYours}
            onChange={(e) => {
              setOnlyYours(e.target.checked);
              setVisible(30);
            }}
          />
          Your teams only
        </label>
      </div>
      <p className="stat-legend" role="status">
        {filtered.length} recorded {filtered.length === 1 ? "story" : "stories"}
        {onlyYours ? " · Your teams" : " · Whole league"}
      </p>
      <ol className="news-feed">
        {filtered.slice(0, visible).map((story) => (
          <li key={story.id}>
            <article className={`news-story news-${story.category}`}>
              <span className="news-category">{labels[story.category]}</span>
              <h4>{story.headline}</h4>
              <p>{story.body}</p>
              <p className="news-source">{story.source}</p>
              {story.details.length > 0 && (
                <details>
                  <summary>Recorded details</summary>
                  <ul>
                    {story.details.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                </details>
              )}
              {((onPlayer && story.pokemonIds.length > 0) ||
                (onGame &&
                  story.gameId &&
                  (canOpenGame?.(story.gameId, story.year) ?? true))) && (
                <div className="news-links">
                  {onGame &&
                    story.gameId &&
                    (canOpenGame?.(story.gameId, story.year) ?? true) && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => onGame(story.gameId!, story.year)}
                      >
                        Open game
                      </button>
                    )}
                  {onPlayer &&
                    story.pokemonIds.map((id) => (
                      <button
                        type="button"
                        className="text-button"
                        key={id}
                        onClick={() => onPlayer(id, story.year)}
                      >
                        View {POKEMON_BY_ID.get(id)?.name ?? `Pokémon #${id}`}
                      </button>
                    ))}
                </div>
              )}
            </article>
          </li>
        ))}
      </ol>
      {!filtered.length && (
        <p className="league-empty">No recorded stories match these filters.</p>
      )}
      {filtered.length > visible && (
        <button
          type="button"
          className="button secondary"
          onClick={() => setVisible((n) => n + 30)}
        >
          Show more stories
        </button>
      )}
      <p className="stat-legend">
        Earlier saves may not include game or mastery records. Their saved
        honors and transactions remain available.
      </p>
    </section>
  );
}
