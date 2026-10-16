import type { ArcadeInput } from "../game/arcade/types";
import { isNeutralGamepad, neutralGamepad, type GamepadInput } from "./gamepad";
export type TouchAction = "shoot" | "pass" | "switch" | "turbo";
const KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyJ",
  "KeyK",
  "KeyL",
  "ShiftLeft",
  "ShiftRight",
  "Escape",
  "KeyP",
]);

/** Keyboard, gamepad and multiple independent touch pointers share held state and one-shot edges. */
export class ArcadeInputController {
  private gamepad = neutralGamepad();
  private gamepadArmed = false;

  updateGamepad(next: GamepadInput | null) {
    if (!next) {
      if (this.gamepad.shoot) this.cancelledShot = true;
      this.gamepad = neutralGamepad();
      this.gamepadArmed = false;
      return;
    }
    if (!this.gamepadArmed) {
      this.gamepadArmed = isNeutralGamepad(next);
      return;
    }
    if (next.pass && !this.gamepad.pass) this.pass = true;
    if (next.switch && !this.gamepad.switch) this.switch = true;
    if (next.pause && !this.gamepad.pause) this.pause = true;
    this.gamepad = next;
  }

  private keys = new Set<string>();
  private pointers = new Map<number, TouchAction | { x: number; y: number }>();
  private pass = false;
  private switch = false;
  private pause = false;
  private cancelledShot = false;

  keyDown(code: string, repeat = false): boolean {
    if (!KEYS.has(code)) return false;
    if (repeat || this.keys.has(code)) return true;
    this.keys.add(code);
    if (code === "KeyK") this.pass = true;
    if (code === "KeyL") this.switch = true;
    if (code === "Escape" || code === "KeyP") this.pause = true;
    return true;
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
  pointerDown(id: number, action: TouchAction) {
    if (this.pointers.has(id)) return;
    this.pointers.set(id, action);
    if (action === "pass") this.pass = true;
    if (action === "switch") this.switch = true;
  }
  movePointer(id: number, x: number, y: number) {
    const length = Math.max(1, Math.hypot(x, y));
    this.pointers.set(id, { x: x / length, y: y / length });
  }
  pointerUp(id: number, cancel = false) {
    if (cancel && this.pointers.get(id) === "shoot") this.cancelledShot = true;
    this.pointers.delete(id);
  }
  clear() {
    this.gamepad = neutralGamepad();
    this.gamepadArmed = false;
    this.keys.clear();
    this.pointers.clear();
    this.pass = this.switch = this.pause = this.cancelledShot = false;
  }
  consumePause() {
    const value = this.pause;
    this.pause = false;
    return value;
  }
  consumeShotCancellation() {
    const value = this.cancelledShot;
    this.cancelledShot = false;
    return value;
  }
  read(): ArcadeInput {
    const held = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code));
    let moveX =
      Number(held("KeyD", "ArrowRight")) - Number(held("KeyA", "ArrowLeft"));
    let moveY =
      Number(held("KeyS", "ArrowDown")) - Number(held("KeyW", "ArrowUp"));
    let shoot = held("KeyJ"),
      turbo = held("ShiftLeft", "ShiftRight");
    for (const value of this.pointers.values()) {
      if (typeof value === "object") {
        moveX += value.x;
        moveY += value.y;
      } else if (value === "shoot") shoot = true;
      else if (value === "turbo") turbo = true;
    }
    moveX += this.gamepad.moveX;
    moveY += this.gamepad.moveY;
    shoot ||= this.gamepad.shoot;
    turbo ||= this.gamepad.turbo;
    const length = Math.max(1, Math.hypot(moveX, moveY));
    const result = {
      moveX: moveX / length,
      moveY: moveY / length,
      shoot,
      turbo,
      pass: this.pass,
      switch: this.switch,
    };
    this.pass = this.switch = false;
    return result;
  }
}
