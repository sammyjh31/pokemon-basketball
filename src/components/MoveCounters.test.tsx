import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { GameCounterReport } from "./GameCounterReport";
import { MoveUsage, MovesetPanel } from "./MovesetPanel";
import { signatureTeam } from "../game/signatureTestUtils";
it("explains automatic coaching and reports observed pregame evidence without controls", () => {
  const home = { ...signatureTeam(), movesetVersion: 3 as const },
    away = {
      ...signatureTeam(),
      id: 1,
      name: "Rivals",
      movesetVersion: 3 as const,
    };
  render(
    <>
      <MovesetPanel team={home} />
      <GameCounterReport
        plans={{
          home: [{ id: "contain-burst", observations: 6, confidence: 0.5 }],
          away: [],
        }}
        teams={[home, away]}
        sequences={[]}
      />
    </>,
  );
  expect(
    screen.getByRole("region", { name: "Basketball movesets" }),
  ).toHaveTextContent(/automatically.*counter/i);
  const report = screen.getByRole("region", { name: "Coach counter scouting" });
  expect(report).toHaveTextContent("Contain the burst");
  expect(report).toHaveTextContent("50%");
  expect(report).toHaveTextContent(/first meeting|not enough/i);
});
it("shows actual participant counter usage in the shared season/playoff/career stats component", () => {
  render(
    <MoveUsage
      rows={[
        {
          key: 1,
          label: "Pikachu",
          abilityActivations: {
            offense: 0,
            support: 0,
            defense: 0,
            moves: {
              uses: {},
              energySpent: 9,
              energyRecovered: 0,
              counters: {
                responses: { "contain-burst": 2 },
                counterCombos: { "slip-and-seal": 1 },
              },
            },
          },
        },
      ]}
    />,
  );
  const report = screen.getByRole("region", { name: "Basketball move usage" });
  expect(report).toHaveTextContent("Contain the burst ×2");
  expect(report).toHaveTextContent("Slip and seal ×1");
  expect(report).toHaveTextContent(/not.*stops/i);
});
