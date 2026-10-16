import { useEffect, useState, type RefObject } from "react";
import {
  isNeutralGamepad,
  neutralGamepad,
  readStandardGamepad,
} from "../arcade/gamepad";
import type { ArcadeInputController } from "../arcade/input";

const WAITING =
  "Controller: connect an Xbox-compatible controller, then press a button to detect it.";
const UNAVAILABLE =
  "Controller unavailable in this browser. Try Chrome or Edge over HTTPS or localhost; keyboard and touch still work.";

/** Input and menu navigation stay inside this arcade, including its active dialog. */
export function useArcadeGamepad(
  root: RefObject<HTMLElement | null>,
  input: ArcadeInputController,
) {
  const [status, setStatus] = useState(WAITING);
  useEffect(() => {
    let frameId = 0,
      active: { index: number; id: string } | null = null;
    let previous = neutralGamepad(),
      armed = false,
      direction = 0,
      repeatAt = 0;
    let lastMessage = WAITING,
      disconnected = false;
    const message = (next: string) => {
      if (next !== lastMessage) {
        lastMessage = next;
        setStatus(next);
      }
    };
    const suspend = () => {
      input.updateGamepad(null);
      previous = neutralGamepad();
      armed = false;
      direction = 0;
    };
    const poll = (now: number) => {
      const shell = root.current;
      if (!shell) {
        frameId = requestAnimationFrame(poll);
        return;
      }
      let pads: (Gamepad | null)[] = [];
      let available = typeof navigator.getGamepads === "function";
      try {
        if (available) pads = Array.from(navigator.getGamepads());
      } catch {
        available = false;
      }
      const current =
        active &&
        pads.find(
          (pad) =>
            pad?.connected &&
            pad.mapping === "standard" &&
            pad.index === active!.index &&
            pad.id === active!.id,
        );
      if (active && !current) {
        suspend();
        // Cancels a charge through the runtime's existing pause path, never releases a shot.
        shell.querySelector<HTMLButtonElement>("[data-gamepad-pause]")?.click();
        active = null;
        disconnected = true;
      }
      const pad =
        current ||
        pads.find((pad) => pad?.connected && pad.mapping === "standard");
      if (!pad) {
        suspend();
        message(
          !available
            ? UNAVAILABLE
            : disconnected
              ? "Controller disconnected. Reconnect or use keyboard/touch; any active game has been paused."
              : pads.some((pad) => pad?.connected)
                ? "Controller detected but not mapped to a standard layout. Use keyboard/touch or a standard Xbox-compatible controller."
                : WAITING,
        );
      } else {
        if (!active) {
          active = { index: pad.index, id: pad.id };
          suspend();
        }
        disconnected = false;
        message(
          "Controller connected · Xbox layout · X shoot/block · A pass/steal · B switch · RT turbo · Menu pause",
        );
        const next = readStandardGamepad(pad)!;
        if (document.hidden || !document.hasFocus()) {
          suspend();
        } else if (!armed) {
          armed = isNeutralGamepad(next);
          if (armed) input.updateGamepad(next);
          previous = next;
        } else {
          const playArea = shell.querySelector<HTMLElement>(
            "[data-gamepad-play]:not([inert])",
          );
          if (playArea?.contains(document.activeElement)) {
            input.updateGamepad(next);
            direction = 0;
          } else {
            input.updateGamepad(null);
            const dialog = shell.querySelector<HTMLElement>('[role="dialog"]');
            const scope = dialog ?? shell;
            const controls = Array.from(
              scope.querySelectorAll<HTMLElement>(
                "button:not(:disabled),select:not(:disabled),input:not(:disabled),summary",
              ),
            ).filter(
              (el) =>
                !el.closest("[inert],[hidden]") &&
                (!el.closest("details:not([open])") ||
                  el.tagName === "SUMMARY") &&
                el.getClientRects().length > 0,
            );
            const focused = controls.find(
              (el) => el === document.activeElement,
            );
            const nav =
              Math.abs(next.moveY) > 0.5
                ? Math.sign(next.moveY)
                : Math.abs(next.moveX) > 0.5
                  ? 2 * Math.sign(next.moveX)
                  : 0;
            if (nav && (nav !== direction || now >= repeatAt)) {
              if (Math.abs(nav) === 2 && focused instanceof HTMLSelectElement) {
                const options = Array.from(focused.options).filter(
                  (option) =>
                    !option.disabled &&
                    !option.parentElement?.matches("optgroup:disabled"),
                );
                const index = options.findIndex((option) => option.selected);
                const option =
                  options[
                    (index + Math.sign(nav) + options.length) % options.length
                  ];
                if (option) {
                  focused.value = option.value;
                  focused.dispatchEvent(new Event("change", { bubbles: true }));
                }
              } else if (controls.length) {
                const index = focused
                  ? controls.indexOf(focused)
                  : nav > 0
                    ? -1
                    : 0;
                controls[
                  (index + Math.sign(nav) + controls.length) % controls.length
                ].focus();
              }
              repeatAt = now + (nav === direction ? 180 : 400);
            }
            direction = nav;
            if (next.pause && !previous.pause)
              scope
                .querySelector<HTMLButtonElement>("[data-gamepad-resume]")
                ?.click();
            else if (next.switch && !previous.switch && dialog)
              dialog.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
              );
            else if (next.pass && !previous.pass) {
              const target =
                focused ??
                controls.find((el) => el.matches(".arcade-primary")) ??
                controls[0];
              target?.focus();
              if (!(target instanceof HTMLSelectElement)) target?.click();
            }
          }
          previous = next;
        }
      }
      frameId = requestAnimationFrame(poll);
    };
    frameId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frameId);
      input.updateGamepad(null);
    };
  }, [root, input]);
  return status;
}
