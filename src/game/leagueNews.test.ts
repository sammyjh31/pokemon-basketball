import type { LocalLeague } from "./localLeague";
import { describe, expect, it } from "vitest";
import {
  buildLeagueNews,
  localNewsSources,
  type LeagueNewsSeason,
} from "./leagueNews";

const source: LeagueNewsSeason = {
  year: 2,
  teams: [
    { id: 0, name: "Kanto" },
    { id: 1, name: "Johto" },
    { id: 2, name: "Hoenn" },
  ],
  games: [
    {
      id: "g1",
      round: 0,
      homeTeamId: 0,
      awayTeamId: 1,
      seed: 1,
      homeScore: 90,
      awayScore: 100,
      overtimePeriods: 0,
    },
    {
      id: "g2",
      round: 1,
      homeTeamId: 2,
      awayTeamId: 1,
      seed: 2,
      homeScore: 120,
      awayScore: 92,
      overtimePeriods: 0,
      masteryMilestones: [
        {
          teamId: 2,
          pokemonId: 6,
          before: 74.9,
          after: 75.2,
          gained: 0.3,
          levelBefore: "Developing",
          levelAfter: "Practiced",
        },
      ],
    },
  ],
  development: [
    {
      teamId: 2,
      pokemonId: 6,
      before: 65,
      after: 68,
      outcome: "growth",
      changes: { passing: 3 },
    },
  ],
  mastery: [
    {
      teamId: 1,
      pokemonId: 9,
      before: 180,
      after: 210,
      gained: 30,
      levelBefore: "Practiced",
      levelAfter: "Skilled",
      focus: "defense",
      breakthrough: false,
      reasons: ["Recorded coach fit supported practice."],
    },
  ],
  trades: [{ teamId: 2, fromTeamId: 1, giveId: 9, receiveId: 6, year: 2 }],
  picks: [{ pick: 1, teamId: 2, pokemonId: 152, releasedId: 6 }],
  signings: [{ teamId: 1, pokemonId: 6, releasedId: 9 }],
  coaching: [
    {
      teamId: 2,
      from: "brock",
      to: "misty",
      source: "cpu",
      reason: "Recorded coaching change.",
    },
  ],
  awards: [
    {
      id: "mvp",
      title: "Most Valuable Player",
      teamId: 2,
      pokemonId: 6,
      value: "24.1 PPG",
      description: "Recorded award",
    },
  ],
  championId: 2,
};

describe("league news", () => {
  it("covers CPU clubs and exactly reports recorded scores, development, and transactions", () => {
    const news = buildLeagueNews([source]);
    expect(
      news.some((s) => s.teamIds.includes(2) && !s.teamIds.includes(0)),
    ).toBe(true);
    expect(news.find((s) => s.id === "2:week:1:1")?.body).toContain("1–1");
    expect(news.find((s) => s.id === "2:week:1:1")?.details).toContain(
      "Johto 100–90 Kanto",
    );
    expect(news.find((s) => s.id === "2:game:g2")?.body).toBe(
      "Hoenn beat Johto 120–92.",
    );
    expect(news.find((s) => s.id === "2:development:2:6")?.body).toContain(
      "65.0 → 68.0",
    );
    expect(
      news.find((s) => s.id === "2:mastery:training:1:9")?.details,
    ).toContain("Recorded coach fit supported practice.");
    expect(news.find((s) => s.id === "2:trade:0")?.body).toContain(
      "Johto sent Blastoise to Hoenn",
    );
    expect(news.find((s) => s.id === "2:pick:1")?.body).toContain(
      "released Charizard",
    );
    expect(news.find((s) => s.id === "2:signing:0")?.body).toContain(
      "signed Charizard",
    );
    expect(news.find((s) => s.id === "2:champion")?.headline).toBe(
      "Hoenn win the championship",
    );
    expect(news.some((s) => s.category === "honors")).toBe(true);
    expect(JSON.stringify(news)).not.toMatch(/said|believes|because|tactical/i);
  });

  it("has stable IDs/order, deduplicates overlapping current and archived facts, and never mutates sources", () => {
    const before = JSON.stringify(source);
    const news = buildLeagueNews([source]);
    expect(buildLeagueNews([source, structuredClone(source)])).toEqual(news);
    expect(buildLeagueNews([structuredClone(source)])).toEqual(news);
    expect(new Set(news.map((s) => s.id)).size).toBe(news.length);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("does not invent missing historical game or mastery facts", () => {
    const news = buildLeagueNews([
      { year: 1, teams: source.teams, championId: 1 },
    ]);
    expect(news).toHaveLength(1);
    expect(news[0].category).toBe("honors");
    expect(news[0].source).toContain("Year 1");
    expect(buildLeagueNews([{ year: 1, teams: source.teams }])).toEqual([]);
  });

  it("keeps playoff stories after regular results and out of weekly recaps", () => {
    const regular = { ...source.games![0], id: "g-final", round: 81 };
    const playoff = {
      ...source.games![1],
      id: "p1-r4-s1-g1",
      round: 3,
      masteryMilestones: undefined,
    };
    const news = buildLeagueNews([
      { year: 3, teams: source.teams, games: [regular, playoff] },
    ]);
    expect(news[0].id).toBe("3:game:p1-r4-s1-g1");
    expect(
      news
        .filter((s) => s.id.includes(":week:"))
        .every((s) => s.id.includes(":week:12:")),
    ).toBe(true);
  });

  it("labels season high performances as season records without assigning a game", () => {
    const news = buildLeagueNews([
      {
        year: 1,
        teams: source.teams,
        players: [{ pokemonId: 25, teamId: 1, highPoints: 48, gamesPlayed: 5 }],
      },
    ]);
    expect(news[0].body).toContain(
      "48-point season high across 5 recorded games",
    );
    expect(news[0].gameId).toBeUndefined();
  });
});

it("preserves local season-high stories from saved compact archive facts", () => {
  const archive = {
    year: 1,
    teams: source.teams,
    newsPlayers: [
      { pokemonId: 25, teamId: 1, highPoints: 48, gamesPlayed: 14 },
    ],
    awards: [],
    championId: null,
    finalsMvp: null,
    development: [],
    trades: [],
    rookiePicks: [],
  };
  const draft = {
    career: { year: 2, phase: "season", history: [archive] },
  } as unknown as LocalLeague;
  const archived = buildLeagueNews(localNewsSources(draft));
  expect(archived).toHaveLength(1);
  expect(archived[0].id).toBe("1:performance:1:25");
  expect(archived[0].body).toContain(
    "48-point season high across 14 recorded games",
  );
});
