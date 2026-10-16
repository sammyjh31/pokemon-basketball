import type { ArcadeInput, ArcadePlayer, ArcadeState } from "./types";
import {
  activePlayers,
  attackDirection,
  basket,
  clamp,
  distance,
  other,
  passTarget,
  random,
} from "./helpers";
import { attemptSteal, jump, makePass, releaseShot } from "./actions";
export interface Motion {
  x: number;
  y: number;
  turbo: boolean;
}
function toward(p: ArcadePlayer, x: number, y: number, turbo = false): Motion {
  const dx = x - p.x,
    dy = y - p.y,
    d = Math.hypot(dx, dy);
  return d < 0.15
    ? { x: 0, y: 0, turbo: false }
    : {
        x: (dx / d) * Math.min(1, d * 2),
        y: (dy / d) * Math.min(1, d * 2),
        turbo,
      };
}
export function aiMotion(s: ArcadeState, p: ArcadePlayer): Motion {
  const mates = activePlayers(s, p.team),
    foes = activePlayers(s, other(p.team));
  const rim = basket(s, p.team),
    dir = attackDirection(s, p.team),
    role = mates.findIndex((q) => q.id === p.id);
  const owner = s.ball.owner === null ? undefined : s.players[s.ball.owner];
  if (s.ball.mode === "pass" && s.ball.target === p.id)
    return toward(p, s.ball.end.x, s.ball.end.y);
  if (s.ball.mode === "loose" || s.ball.mode === "shot") {
    const chase = [...mates]
      .sort((a, b) => distance(a, s.ball) - distance(b, s.ball))
      .slice(0, 3)
      .some((q) => q.id === p.id);
    if (chase)
      return toward(
        p,
        s.ball.mode === "shot" ? s.ball.end.x : s.ball.x,
        s.ball.mode === "shot" ? s.ball.end.y : s.ball.y,
        true,
      );
    return toward(p, 14 - dir * 3, role < 2 ? 3 : 12);
  }
  if (owner?.team === p.team) {
    if (owner.id === p.id) {
      if (p.charge !== null) return { x: 0, y: 0, turbo: false };
      const openY = 7.5 + Math.sin(s.elapsed * 0.8 + p.id) * 2.4;
      const nearest = Math.min(10, ...foes.map((q) => distance(p, q)));
      return toward(
        p,
        rim.x - dir * 1.2,
        nearest < 1.8 ? openY : 7.5,
        p.energy > 35 && distance(p, rim) > 4,
      );
    }
    const attackProgress = dir > 0 ? owner.x : 28 - owner.x;
    if (attackProgress < 13) {
      const x = clamp(owner.x + dir * (role === 4 ? -2 : 4 + role), 2, 26);
      return toward(p, x, [7.5, 2.7, 12.3, 5.2, 9.8][role], p.energy > 40);
    }
    const cycle = (s.elapsed + p.team * 1.3) % 7;
    if (role === 3 && cycle < 2.2) {
      const x = clamp(owner.x + dir * 1.3, 2, 26),
        y = clamp(owner.y + 1.1, 1, 14);
      if (distance(p, { x, y }) < 0.45) {
        p.action = "screen";
        p.actionTime = 0.12;
        return { x: 0, y: 0, turbo: false };
      }
      return toward(p, x, y);
    }
    if ((role === 3 && cycle < 4.5) || (role === 2 && cycle > 4.5))
      return toward(p, rim.x - dir * 1.4, role === 3 ? 6.5 : 8.6, true);
    const back = [7, 6, 6, 3, 2.5][role],
      ys = [7.5, 2.4, 12.6, 4.5, 10.3];
    return toward(p, rim.x - dir * back, ys[role]);
  }
  const assigned = foes[role % foes.length];
  if (!assigned) return { x: 0, y: 0, turbo: false };
  const defendingRim = basket(s, other(p.team));
  const dx = defendingRim.x - assigned.x,
    dy = defendingRim.y - assigned.y,
    len = Math.hypot(dx, dy) || 1;
  const gap = assigned.id === owner?.id ? 1 : 0.8;
  return toward(
    p,
    clamp(assigned.x + (dx / len) * gap, 0.6, 27.4),
    clamp(assigned.y + (dy / len) * gap, 0.6, 14.4),
    distance(p, assigned) > 4 && p.energy > 35,
  );
}
export function aiDecisions(s: ArcadeState) {
  const owner = s.ball.owner === null ? undefined : s.players[s.ball.owner];
  for (const p of activePlayers(s)) {
    if (p.id === s.controlled && p.team === 0) continue;
    if (owner?.id === p.id) {
      if (p.charge !== null) {
        if (p.charge > 0.5) releaseShot(s, p, p.charge, p.energy > 15);
        continue;
      }
      if (p.cooldown > 0) continue;
      const d = distance(p, basket(s, p.team)),
        nearest = Math.min(
          12,
          ...activePlayers(s, other(p.team)).map((e) => distance(e, p)),
        );
      if (
        d < 2.7 ||
        (d < 7.1 && nearest > 1.0 && random(s) < 0.35) ||
        s.shotClock < 3.3
      ) {
        p.charge = 0.001;
        continue;
      }
      const target = passTarget(s, p);
      if (target && random(s) < (nearest < 1.6 ? 0.25 : 0.07))
        makePass(s, p, target, distance(target, basket(s, p.team)) < 2.8);
    } else if (
      owner &&
      owner.team !== p.team &&
      distance(p, owner) < 1.15 &&
      random(s) < 0.32
    )
      attemptSteal(s, p);
    else if (
      s.ball.mode === "shot" &&
      s.ball.lastTouch !== p.team &&
      distance(p, s.ball) < 1.7
    )
      jump(s, p);
    else if (
      s.ball.mode === "loose" &&
      distance(p, s.ball) < 1.3 &&
      random(s) < 0.4
    )
      jump(s, p);
  }
}
export function movePlayers(
  s: ArcadeState,
  input: ArcadeInput,
  dt: number,
): boolean {
  let out = false;
  for (const p of s.players) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.actionTime = Math.max(0, p.actionTime - dt);
    if (!p.active) {
      p.energy = Math.min(100, p.energy + dt * 12);
      continue;
    }
    p.jumpTime = Math.max(0, p.jumpTime - dt);
    p.z =
      p.jumpTime > 0
        ? Math.sin((p.jumpTime / 0.65) * Math.PI) *
          (1 + p.attributes.vertical * 0.012)
        : 0;
    if (p.charge !== null) p.charge += dt;
    const human = p.team === 0 && p.id === s.controlled;
    const motion = human
      ? { x: input.moveX, y: input.moveY, turbo: input.turbo }
      : aiMotion(s, p);
    const magnitude = Math.hypot(motion.x, motion.y);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    const turbo = motion.turbo && p.energy > 1 && magnitude > 0.1;
    const speed =
      (3.5 + p.attributes.speed * 0.02) *
      (turbo ? 1.45 : 1) *
      (0.8 + p.energy * 0.002) *
      (p.charge !== null ? 0.35 : 1);
    p.vx += (motion.x * scale * speed - p.vx) * Math.min(1, dt * 16);
    p.vy += (motion.y * scale * speed - p.vy) * Math.min(1, dt * 16);
    const nx = p.x + p.vx * dt,
      ny = p.y + p.vy * dt;
    if (
      s.ball.owner === p.id &&
      (nx < 0.4 || nx > 27.6 || ny < 0.4 || ny > 14.6)
    )
      out = true;
    p.x = clamp(nx, 0.4, 27.6);
    p.y = clamp(ny, 0.4, 14.6);
    if (Math.abs(p.vx) > 0.1) p.facing = Math.sign(p.vx);
    p.energy = clamp(
      p.energy +
        dt *
          (turbo
            ? -(23 - p.attributes.stamina * 0.07) *
              (s.fire[p.team] > 0 ? 0.5 : 1)
            : 5),
      0,
      100,
    );
    if (p.actionTime <= 0) p.action = magnitude > 0.1 ? "run" : "idle";
  }
  const all = activePlayers(s);
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i],
        b = all[j],
        dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy),
        min = 0.84;
      if (d < min) {
        const ux = d > 0.001 ? dx / d : 1,
          uy = d > 0.001 ? dy / d : 0,
          push = min - d,
          weight = clamp(
            0.5 + (b.attributes.strength - a.attributes.strength) * 0.002,
            0.35,
            0.65,
          );
        a.x = clamp(a.x - ux * push * weight, 0.4, 27.6);
        a.y = clamp(a.y - uy * push * weight, 0.4, 14.6);
        b.x = clamp(b.x + ux * push * (1 - weight), 0.4, 27.6);
        b.y = clamp(b.y + uy * push * (1 - weight), 0.4, 14.6);
      }
    }
  return out;
}
