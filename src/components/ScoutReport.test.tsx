import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { ScoutReport } from "./ScoutReport";

describe("the full scouting report", () => {
  it("makes nine advanced tools available alongside the original skills and factual stats", () => {
    render(<ScoutReport mon={POKEMON_BY_ID.get(208)!} />);
    fireEvent.click(screen.getByText("Full scouting report", { exact: false }));
    const tools = screen.getByRole("region", {
      name: "Advanced tools and tendencies",
    });
    expect(within(tools).getAllByRole("term")).toHaveLength(9);
    for (const value of within(tools).getAllByRole("definition")) {
      expect(Number(value.textContent)).toBeGreaterThanOrEqual(0);
      expect(Number(value.textContent)).toBeLessThanOrEqual(100);
    }
    expect(
      screen.getByRole("heading", { name: "Overall skills" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pokémon source stats" }),
    ).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText(/9.2 m · 400 kg/)).toBeInTheDocument();
  });
});

it("shows stable personality traits in enabled scouting and keeps legacy reports unchanged", () => {
  const mon = POKEMON_BY_ID.get(59)!;
  const view = render(<ScoutReport mon={mon} personalityVersion={1} />);
  const personality = screen.getByRole("region", {
    name: "Basketball personality",
  });
  expect(personality).toHaveTextContent("Steady professional");
  expect(personality).toHaveTextContent("Challenger");
  expect(within(personality).getAllByRole("term")).toHaveLength(5);
  expect(personality).toHaveTextContent(/stable basketball adaptation/i);
  view.rerender(<ScoutReport mon={mon} />);
  expect(
    screen.queryByRole("region", { name: "Basketball personality" }),
  ).not.toBeInTheDocument();
});
