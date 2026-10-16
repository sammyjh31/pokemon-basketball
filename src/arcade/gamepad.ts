import type { ArcadeInput } from "../game/arcade/types";

export type GamepadInput = ArcadeInput & { pause: boolean };
export const neutralGamepad = (): GamepadInput => ({
  moveX: 0,
  moveY: 0,
  shoot: false,
  pass: false,
  switch: false,
  turbo: false,
  pause: false,
});
export const isNeutralGamepad = (input: GamepadInput) =>
  Object.values(input).every((value) => !value);

/** W3C standard layout: Xbox A/B/X, RT and Menu. Never guess raw device mappings. */
export function readStandardGamepad(pad: Gamepad | null): GamepadInput | null {
  if (!pad?.connected || pad.mapping !== "standard") return null;
  const down = (i: number) =>
    !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.5;
  const axis = (i: number) =>
    Number.isFinite(pad.axes[i]) ? Math.max(-1, Math.min(1, pad.axes[i])) : 0;
  let x = axis(0),
    y = axis(1);
  const magnitude = Math.hypot(x, y),
    deadZone = 0.2;
  const strength = Math.max(
    0,
    (Math.min(1, magnitude) - deadZone) / (1 - deadZone),
  );
  x = magnitude ? (x / magnitude) * strength : 0;
  y = magnitude ? (y / magnitude) * strength : 0;
  x += Number(down(15)) - Number(down(14));
  y += Number(down(13)) - Number(down(12));
  const length = Math.max(1, Math.hypot(x, y));
  return {
    moveX: x / length,
    moveY: y / length,
    shoot: down(2),
    pass: down(0),
    switch: down(1),
    turbo: down(7),
    pause: down(9),
  };
}
