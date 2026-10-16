import { describe, expect, it } from "vitest";
import { ArcadeInputController } from "./input";

describe("arcade input", () => {
  it("normalizes diagonals and treats passing and switching as fresh edges", () => {
    const input = new ArcadeInputController();
    input.keyDown("KeyW");
    input.keyDown("ArrowRight");
    input.keyDown("KeyK");
    input.keyDown("KeyL");
    const first = input.read();
    expect(first.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(first.moveY).toBeCloseTo(-Math.SQRT1_2);
    expect(first.pass).toBe(true);
    expect(first.switch).toBe(true);
    input.keyDown("KeyK", true);
    expect(input.read().pass).toBe(false);
    input.keyUp("KeyK");
    input.keyDown("KeyK");
    expect(input.read().pass).toBe(true);
  });
  it("holds shoot and turbo across steps, combining keyboard and simultaneous touch pointers", () => {
    const input = new ArcadeInputController();
    input.keyDown("KeyJ");
    input.pointerDown(2, "shoot");
    input.pointerDown(3, "turbo");
    input.movePointer(1, -1, 0.5);
    input.keyUp("KeyJ");
    expect(input.read()).toMatchObject({
      shoot: true,
      turbo: true,
      pass: false,
    });
    input.pointerUp(2);
    expect(input.read()).toMatchObject({ shoot: false, turbo: true });
    input.pointerUp(1);
    expect(input.read()).toMatchObject({ moveX: 0, moveY: 0, turbo: true });
  });
  it("cancels charge and all stale held or edge actions on focus loss", () => {
    const input = new ArcadeInputController();
    input.keyDown("KeyJ");
    input.keyDown("KeyK");
    input.keyDown("KeyP");
    input.pointerDown(1, "turbo");
    input.clear();
    expect(input.read()).toEqual({
      moveX: 0,
      moveY: 0,
      shoot: false,
      pass: false,
      switch: false,
      turbo: false,
    });
    expect(input.consumePause()).toBe(false);
    input.keyDown("KeyJ");
    expect(input.read().shoot).toBe(true);
  });
  it("distinguishes pointer cancellation from an intentional shot release", () => {
    const input = new ArcadeInputController();
    input.pointerDown(1, "shoot");
    input.pointerUp(1, true);
    expect(input.consumeShotCancellation()).toBe(true);
    expect(input.consumeShotCancellation()).toBe(false);
    input.pointerDown(2, "shoot");
    input.pointerUp(2);
    expect(input.consumeShotCancellation()).toBe(false);
  });
  it("debounces pause and ignores unrelated keys", () => {
    const input = new ArcadeInputController();
    expect(input.keyDown("Space")).toBe(false);
    expect(input.keyDown("Escape")).toBe(true);
    expect(input.consumePause()).toBe(true);
    input.keyDown("Escape", true);
    expect(input.consumePause()).toBe(false);
  });
});
