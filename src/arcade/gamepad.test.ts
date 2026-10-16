import { describe, expect, it } from "vitest";
import { readStandardGamepad } from "./gamepad";
import { ArcadeInputController } from "./input";

function pad(pressed: number[] = [], axes = [0, 0]) {
  return {
    mapping: "standard",
    connected: true,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i),
      value: pressed.includes(i) ? 1 : 0,
    })),
  } as unknown as Gamepad;
}
describe("Xbox / standard gamepad input", () => {
  it("maps Xbox buttons, analog movement and D-pad with a drift dead zone", () => {
    expect(
      readStandardGamepad(pad([0, 1, 2, 7, 9], [0.1, -0.1])),
    ).toMatchObject({
      moveX: 0,
      moveY: 0,
      shoot: true,
      pass: true,
      switch: true,
      turbo: true,
      pause: true,
    });
    const diagonal = readStandardGamepad(pad([], [1, -1]))!;
    expect(diagonal.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(diagonal.moveY).toBeCloseTo(-Math.SQRT1_2);
    expect(readStandardGamepad(pad([12, 15]))!.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(readStandardGamepad(pad([12, 15]))!.moveY).toBeCloseTo(
      -Math.SQRT1_2,
    );
    expect(readStandardGamepad(pad([], [0.6, 0]))!.moveX).toBeCloseTo(0.5);
    expect(readStandardGamepad({ ...pad(), mapping: "" })).toBeNull();
    expect(readStandardGamepad({ ...pad(), connected: false })).toBeNull();
  });
  it("holds shots/turbo, debounces actions across frames and preserves other input sources", () => {
    const input = new ArcadeInputController();
    input.updateGamepad(readStandardGamepad(pad()));
    input.updateGamepad(readStandardGamepad(pad([0, 1, 2, 7, 9], [1, 0])));
    expect(input.read()).toMatchObject({
      moveX: 1,
      shoot: true,
      turbo: true,
      pass: true,
      switch: true,
    });
    expect(input.consumePause()).toBe(true);
    input.updateGamepad(readStandardGamepad(pad([0, 1, 2, 7, 9])));
    expect(input.read()).toMatchObject({
      shoot: true,
      turbo: true,
      pass: false,
      switch: false,
    });
    expect(input.consumePause()).toBe(false);
    input.keyDown("KeyJ");
    input.updateGamepad(readStandardGamepad(pad()));
    expect(input.read().shoot).toBe(true);
    input.keyUp("KeyJ");
    expect(input.read().shoot).toBe(false);
    input.updateGamepad(readStandardGamepad(pad([0])));
    expect(input.read().pass).toBe(true);
  });
  it("requires neutral controls after clear and cancels a disconnected charging shot", () => {
    const input = new ArcadeInputController();
    input.updateGamepad(readStandardGamepad(pad([2])));
    expect(input.read().shoot).toBe(false);
    input.updateGamepad(readStandardGamepad(pad()));
    input.updateGamepad(readStandardGamepad(pad([2])));
    expect(input.read().shoot).toBe(true);
    input.updateGamepad(null);
    expect(input.consumeShotCancellation()).toBe(true);
    expect(input.read().shoot).toBe(false);
    input.clear();
    input.updateGamepad(readStandardGamepad(pad([0, 2])));
    expect(input.read()).toMatchObject({ pass: false, shoot: false });
    input.updateGamepad(readStandardGamepad(pad()));
    input.updateGamepad(readStandardGamepad(pad([2])));
    expect(input.read().shoot).toBe(true);
  });
});
