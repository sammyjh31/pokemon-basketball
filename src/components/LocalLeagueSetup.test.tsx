import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LocalLeagueSetup } from "./LocalLeagueSetup";
import type { LocalLeague } from "../game/localLeague";
describe("local franchise configuration", () => {
  it("starts a bounded GenI league with enabled abilities and custom playoffs", () => {
    let draft: LocalLeague | undefined;
    render(
      <LocalLeagueSetup
        onStart={(d) => {
          draft = d;
        }}
      />,
    );
    expect(screen.getByLabelText("Franchise progression")).toHaveValue(
      "generational",
    );
    expect(
      screen.queryByRole("option", { name: "30 teams" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("League size"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Games per team"), {
      target: { value: "14" },
    });
    fireEvent.change(screen.getByLabelText("Playoff series"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start snake draft" }));
    expect(draft?.options).toMatchObject({
      mode: "generational",
      format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
      engineRules: { version: 1, abilities: true },
    });
  });
  it("offers all generations without rookie drafts and keeps managers unique when shrinking", () => {
    let draft: LocalLeague | undefined;
    render(
      <LocalLeagueSetup
        onStart={(d) => {
          draft = d;
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Franchise progression"), {
      target: { value: "full-pool" },
    });
    fireEvent.change(screen.getByLabelText("League size"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Friend 2 team"), {
      target: { value: "29" },
    });
    fireEvent.change(screen.getByLabelText("League size"), {
      target: { value: "4" },
    });
    expect(screen.getByLabelText("Friend 2 team")).toHaveValue("1");
    fireEvent.click(screen.getByLabelText("Signature abilities"));
    fireEvent.click(screen.getByRole("button", { name: "Start snake draft" }));
    expect(draft?.options?.mode).toBe("full-pool");
    expect(draft?.options?.engineRules.abilities).toBe(false);
    expect(draft?.order).toHaveLength(4);
  });
});
