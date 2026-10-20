import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import type { LeagueTeam } from "../game/types";
import { KantoSeasonHub } from "./KantoSeasonHub";

const team: LeagueTeam = {
  id: 0,
  name: "Kanto Basketball Club",
  roster: { PG: 65, SG: 6, SF: 25, PF: 143, C: 9, B1: 121, B2: 149, B3: 3 },
  tactic: "balanced",
  defense: "man",
  rotation: "balanced",
  ratings: { offense: 60, defense: 60, overall: 60, filled: 8, complete: true },
};
const players = [
  {
    playerId: "0:6",
    pokemonId: 6,
    teamId: 0,
    gamesPlayed: 2,
    points: 40,
    offensiveRebounds: 2,
    defensiveRebounds: 4,
    assists: 6,
  },
  {
    playerId: "0:9",
    pokemonId: 9,
    teamId: 0,
    gamesPlayed: 2,
    points: 20,
    offensiveRebounds: 8,
    defensiveRebounds: 16,
    assists: 4,
  },
  {
    playerId: "0:65",
    pokemonId: 65,
    teamId: 0,
    gamesPlayed: 2,
    points: 10,
    offensiveRebounds: 0,
    defensiveRebounds: 2,
    assists: 16,
  },
  {
    playerId: "1:150",
    pokemonId: 150,
    teamId: 1,
    gamesPlayed: 2,
    points: 999,
    offensiveRebounds: 50,
    defensiveRebounds: 50,
    assists: 90,
  },
  {
    playerId: "0:25",
    pokemonId: 25,
    teamId: 0,
    gamesPlayed: 0,
    points: 9999,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
  },
];
it("uses the selected team's real per-game leaders, record and exactly eight roster positions", () => {
  render(
    <KantoSeasonHub
      team={team}
      players={players}
      wins={51}
      losses={31}
      rank={3}
      playoffsAvailable
    />,
  );
  expect(screen.getByRole("heading", { name: team.name })).toBeInTheDocument();
  expect(
    within(screen.getByRole("article", { name: "Scoring leader" })).getByText(
      "20.0",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("article", { name: "Scoring leader" }),
  ).toHaveTextContent("Charizard");
  expect(
    screen.getByRole("article", { name: "Rebounding leader" }),
  ).toHaveTextContent("Blastoise");
  expect(
    screen.getByRole("article", { name: "Rebounding leader" }),
  ).toHaveTextContent("12.0");
  expect(
    screen.getByRole("article", { name: "Assists leader" }),
  ).toHaveTextContent("Alakazam");
  expect(
    screen.getByRole("article", { name: "Assists leader" }),
  ).toHaveTextContent("8.0");
  expect(screen.getByLabelText("Season record")).toHaveTextContent("51");
  expect(screen.getByLabelText("Season record")).toHaveTextContent("31");
  expect(
    within(screen.getByRole("list", { name: "Team roster" })).getAllByRole(
      "listitem",
    ),
  ).toHaveLength(8);
  expect(
    screen.getByRole("button", { name: "View playoffs" }),
  ).toBeInTheDocument();
});
it("does not invent player production or a coach for an unplayed league", () => {
  render(
    <KantoSeasonHub
      team={team}
      players={[]}
      wins={0}
      losses={0}
      rank={null}
      playoffsAvailable={false}
    />,
  );
  expect(
    screen.queryByRole("article", { name: "Scoring leader" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "View playoffs" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Ash")).not.toBeInTheDocument();
});
