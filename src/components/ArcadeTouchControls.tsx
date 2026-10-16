import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArcadeInputController, type TouchAction } from "../arcade/input";
const ACTIONS: [TouchAction, string, string, string][] = [
  ["switch", "Target", "Switch", "L"],
  ["pass", "Pass", "Steal", "K"],
  ["turbo", "Turbo", "Hold", "SHIFT"],
  ["shoot", "Shoot", "Block", "J"],
];
export function ArcadeTouchControls({
  input,
  onActivate,
}: {
  input: ArcadeInputController;
  onActivate: () => void;
}) {
  const padPointer = useRef<number | null>(null),
    [stick, setStick] = useState({ x: 0, y: 0 }),
    [pressed, setPressed] = useState<Set<TouchAction>>(() => new Set());
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(),
      radius = Math.max(1, rect.width * 0.3);
    const x = (event.clientX - rect.left - rect.width / 2) / radius,
      y = (event.clientY - rect.top - rect.height / 2) / radius,
      length = Math.max(1, Math.hypot(x, y));
    input.movePointer(event.pointerId, x, y);
    setStick({ x: x / length, y: y / length });
  };
  const release = (
    event: PointerEvent<HTMLButtonElement>,
    action?: TouchAction,
    cancel = false,
  ) => {
    input.pointerUp(event.pointerId, cancel);
    if (action)
      setPressed((current) => {
        const next = new Set(current);
        next.delete(action);
        return next;
      });
    else if (padPointer.current === event.pointerId) {
      padPointer.current = null;
      setStick({ x: 0, y: 0 });
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div
      className="arcade-touch-controls"
      data-arcade-controls="true"
      aria-label="On-screen game controls"
    >
      <div className="arcade-pad-wrap">
        <button
          className="arcade-move-pad"
          aria-label="Movement pad"
          style={
            {
              "--stick-x": `${stick.x * 28}px`,
              "--stick-y": `${stick.y * 28}px`,
            } as CSSProperties
          }
          onPointerDown={(event) => {
            event.preventDefault();
            if (padPointer.current !== null) return;
            onActivate();
            padPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            move(event);
          }}
          onPointerMove={(event) => {
            if (padPointer.current === event.pointerId) move(event);
          }}
          onPointerUp={(event) => release(event)}
          onPointerCancel={(event) => release(event, undefined, true)}
          onLostPointerCapture={(event) => release(event, undefined, true)}
        >
          <span className="arcade-pad-cross" aria-hidden="true">
            ✣
          </span>
          <span className="arcade-pad-stick" aria-hidden="true" />
        </button>
        <span className="arcade-touch-caption">
          MOVE <kbd>WASD / ↑↓←→</kbd>
        </span>
      </div>
      <div className="arcade-court-tip">
        <b>HOLD. RELEASE. BUCKET.</b>
        <span>
          Release in the bright zone.
          <br />
          Turbo near the basket to dunk.
        </span>
      </div>
      <div className="arcade-action-pad">
        {ACTIONS.map(([action, label, secondary, key]) => (
          <button
            key={action}
            className={`arcade-action-button arcade-action-${action} ${pressed.has(action) ? "pressed" : ""}`}
            aria-label={
              action === "turbo" ? "Turbo" : `${label} / ${secondary}`
            }
            onPointerDown={(event) => {
              event.preventDefault();
              onActivate();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              input.pointerDown(event.pointerId, action);
              setPressed((current) => new Set(current).add(action));
            }}
            onPointerUp={(event) => release(event, action)}
            onPointerCancel={(event) => release(event, action, true)}
            onLostPointerCapture={(event) => release(event, action, true)}
            onBlur={() =>
              input.pointerUp(
                -ACTIONS.findIndex((value) => value[0] === action) - 1,
                true,
              )
            }
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                input.pointerDown(
                  -ACTIONS.findIndex((value) => value[0] === action) - 1,
                  action,
                );
              }
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                input.pointerUp(
                  -ACTIONS.findIndex((value) => value[0] === action) - 1,
                );
              }
            }}
          >
            <kbd>{key}</kbd>
            <strong>{label}</strong>
            <span>{secondary}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
