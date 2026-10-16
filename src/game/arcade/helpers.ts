import { nextRandom } from "../random";
import { POSITIONS } from "../types";
import type { ArcadeInput, ArcadePlayer, ArcadeState, Side } from "./types";
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export const other = (team: Side): Side => (team === 0 ? 1 : 0);
export const activePlayers = (s: ArcadeState, team?: Side) =>
  s.players
    .filter((p) => p.active && (team === undefined || p.team === team))
    .sort(
      (a, b) =>
        a.team - b.team ||
        POSITIONS.indexOf(a.slot) - POSITIONS.indexOf(b.slot) ||
        a.id - b.id,
    );
export const attackDirection = (s: ArcadeState, team: Side): 1 | -1 =>
  (team === 0) === s.period < 3 ? 1 : -1;
export const basket = (s: ArcadeState, team: Side) => ({
  x: attackDirection(s, team) > 0 ? 26.5 : 1.5,
  y: 7.5,
});
export const random = (s: ArcadeState) => {
  const r = nextRandom(s.seed);
  s.seed = r.seed;
  return r.value;
};
export const notify = (s: ArcadeState, message: string) => {
  s.message = message;
  s.messageTime = 2;
};
export function passTarget(
  s: ArcadeState,
  p: ArcadePlayer,
  input?: ArcadeInput,
): ArcadePlayer | undefined {
  const mates = activePlayers(s, p.team).filter((q) => q.id !== p.id);
  if (p.team === 0 && s.passTarget !== null) {
    const explicit = mates.find((q) => q.id === s.passTarget);
    if (explicit) return explicit;
  }
  const mx = input?.moveX ?? attackDirection(s, p.team),
    my = input?.moveY ?? 0;
  return mates.sort((a, b) => {
    const rank = (q: ArcadePlayer) => {
      const dx = q.x - p.x,
        dy = q.y - p.y,
        d = Math.hypot(dx, dy) || 1;
      const open = Math.min(
        5,
        ...activePlayers(s, other(p.team)).map((e) => distance(q, e)),
      );
      return ((dx * mx + dy * my) / d) * 3 + open * 0.5 - d * 0.06;
    };
    return rank(b) - rank(a) || a.id - b.id;
  })[0];
}
