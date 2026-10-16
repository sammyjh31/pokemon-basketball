import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArcadeInputController } from "../arcade/input";
import { ArcadeTouchControls } from "./ArcadeTouchControls";
afterEach(() => vi.unstubAllGlobals());
describe("touch gameplay controls", () => {
  it("cancels a keyboard-held touch action when Tab moves away before keyup", () => {
    const input = new ArcadeInputController();
    render(<ArcadeTouchControls input={input} onActivate={() => {}} />);
    const shoot = screen.getByRole("button", { name: "Shoot / Block" });
    fireEvent.keyDown(shoot, { key: " " });
    expect(input.read().shoot).toBe(true);
    fireEvent.blur(shoot);
    expect(input.read().shoot).toBe(false);
    expect(input.consumeShotCancellation()).toBe(true);
  });
  it("keeps simultaneous movement, turbo, and shooting independent and cancels a lost shot pointer", () => {
    class TouchPointer extends MouseEvent {
      pointerId: number;
      constructor(type: string, options: PointerEventInit = {}) {
        super(type, options);
        this.pointerId = options.pointerId ?? 0;
      }
    }
    vi.stubGlobal("PointerEvent", TouchPointer);
    const input = new ArcadeInputController();
    render(<ArcadeTouchControls input={input} onActivate={() => {}} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Turbo" }), {
      pointerId: 1,
    });
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Shoot / Block" }),
      { pointerId: 2 },
    );
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Movement pad" }),
      { pointerId: 3, clientX: 100, clientY: 50 },
    );
    expect(input.read()).toMatchObject({ shoot: true, turbo: true });
    fireEvent.pointerCancel(
      screen.getByRole("button", { name: "Shoot / Block" }),
      { pointerId: 2 },
    );
    expect(input.consumeShotCancellation()).toBe(true);
    expect(input.read()).toMatchObject({ shoot: false, turbo: true });
    fireEvent.pointerUp(screen.getByRole("button", { name: "Turbo" }), {
      pointerId: 1,
    });
    fireEvent.pointerUp(screen.getByRole("button", { name: "Movement pad" }), {
      pointerId: 3,
    });
    expect(input.read()).toMatchObject({ moveX: 0, moveY: 0, turbo: false });
  });
});
