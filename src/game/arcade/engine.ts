import type { ArcadeInput, ArcadePlayer, ArcadeState, Side } from "./types";
import { NO_INPUT } from "./types";
import {
  activePlayers,
  attackDirection,
  distance,
  notify,
  other,
  passTarget,
  random,
} from "./helpers";
import { TUNE } from "./tuning";
import { emit } from "./events";
import {
  advanceBall,
  attemptSteal,
  giveBall,
  jump,
  makePass,
  releaseShot,
} from "./actions";
import { aiDecisions, movePlayers } from "./ai";
export { activePlayers, attackDirection, basket, passTarget } from "./helpers";
export function setPaused(s: ArcadeState, paused: boolean) {
  s.paused = paused;
  s.prevShoot = false;
  for (const p of s.players) p.charge = null;
}
export function queueSubstitution(
  s: ArcadeState,
  outId: number,
  inId: number,
): boolean {
  const a = s.players[outId],
    b = s.players[inId];
  if (
    !a ||
    !b ||
    a.team !== 0 ||
    b.team !== 0 ||
    !a.active ||
    b.active ||
    s.phase === "final" ||
    s.pendingSubs.some((q) => q.outId === outId || q.inId === inId)
  )
    return false;
  s.pendingSubs.push({ outId, inId });
  return true;
}
export function cancelSubstitution(s: ArcadeState, outId: number) {
  s.pendingSubs = s.pendingSubs.filter((q) => q.outId !== outId);
}
function applySubs(s: ArcadeState) {
  const active = activePlayers(s, 1).sort((a, b) => a.energy - b.energy),
    bench = s.players
      .filter((p) => p.team === 1 && !p.active)
      .sort((a, b) => b.energy - a.energy);
  if (
    active[0] &&
    bench[0] &&
    active[0].energy < 65 &&
    bench[0].energy > active[0].energy + 15
  )
    s.pendingSubs.push({ outId: active[0].id, inId: bench[0].id });
  for (const q of s.pendingSubs) {
    const a = s.players[q.outId],
      b = s.players[q.inId];
    if (!a.active || b.active || a.team !== b.team) continue;
    a.active = false;
    b.active = true;
    b.slot = a.slot;
    b.x = a.x;
    b.y = a.y;
    b.vx = 0;
    b.vy = 0;
    a.charge = null;
    b.charge = null;
    if (s.controlled === a.id) s.controlled = b.id;
    emit(s, { kind: "sub", team: a.team, player: a.id, target: b.id });
  }
  s.pendingSubs = [];
  s.passTarget = null;
}
function formation(s: ArcadeState, team: Side) {
  const dir = attackDirection(s, team),
    offense = activePlayers(s, team),
    defense = activePlayers(s, other(team));
  const spots = [
    [1, 7.5],
    [5, 3.3],
    [7, 11.6],
    [9, 5.2],
    [10, 9.8],
  ];
  offense.forEach((p, i) => {
    p.x = dir > 0 ? spots[i][0] : 28 - spots[i][0];
    p.y = spots[i][1];
    p.vx = p.vy = p.z = p.jumpTime = 0;
    p.charge = null;
    p.facing = dir;
  });
  defense.forEach((p, i) => {
    p.x = dir > 0 ? spots[i][0] + 4 : 24 - spots[i][0];
    p.y = spots[i][1];
    p.vx = p.vy = p.z = p.jumpTime = 0;
    p.charge = null;
    p.facing = -dir;
  });
}
function inbound(s: ArcadeState, team: Side) {
  applySubs(s);
  formation(s, team);
  s.phase = "inbound";
  s.phaseTime = 0;
  s.shotClock = 14;
  s.lastPass = null;
  const p = activePlayers(s, team)[0];
  giveBall(s, p);
  s.possession = team;
  s.ball.reboundOf = null;
  if (team === 1) s.controlled = activePlayers(s, 0)[0].id;
}
function endPeriod(s: ArcadeState) {
  s.clock = 0;
  s.pendingHorn = false;
  s.prevShoot = false;
  s.fire = [0, 0];
  s.streak = [0, 0];
  for (const p of s.players) p.charge = null;
  if (s.period >= 4 && s.score[0] !== s.score[1]) {
    s.phase = "final";
    notify(s, `${s.names[s.score[0] > s.score[1] ? 0 : 1]} wins!`);
  } else {
    s.phase = "break";
    notify(
      s,
      s.period >= 4
        ? "OVERTIME"
        : s.period === 2
          ? "HALFTIME"
          : "END OF QUARTER",
    );
  }
  emit(s, {
    kind: "period",
    team: s.possession,
    player: null,
    value: s.period,
  });
}
export function continuePeriod(s: ArcadeState) {
  if (s.phase !== "break") return;
  s.period++;
  s.clock = s.period > 4 ? (s.official ? 25 : 30) : 60;
  s.pendingHorn = false;
  s.paused = false;
  for (const p of s.players) p.energy = Math.min(100, p.energy + 18);
  inbound(s, s.period % 2 === 1 ? s.openingTeam : other(s.openingTeam));
  notify(s, s.period > 4 ? `OVERTIME ${s.period - 4}` : `QUARTER ${s.period}`);
}
export function playerOfGame(s: ArcadeState): ArcadePlayer {
  const score = (p: ArcadePlayer) => {
    const x = p.stats;
    return (
      x.points +
      1.5 * x.assists +
      1.2 * (x.offensiveRebounds + x.defensiveRebounds) +
      2 * x.steals +
      2 * x.blocks -
      x.turnovers -
      0.5 * (x.fga - x.fgm)
    );
  };
  return [...s.players].sort(
    (a, b) =>
      score(b) - score(a) ||
      b.stats.points - a.stats.points ||
      b.stats.assists - a.stats.assists ||
      a.pokemonId - b.pokemonId,
  )[0];
}
function controls(s: ArcadeState, input: ArcadeInput) {
  const p = s.players[s.controlled];
  if (!p?.active) return;
  if (input.switch) {
    if (s.possession === 0) {
      const mates = activePlayers(s, 0).filter((q) => q.id !== s.ball.owner);
      const i = mates.findIndex((q) => q.id === s.passTarget);
      s.passTarget = mates[(i + 1) % mates.length]?.id ?? null;
    } else {
      const choices = activePlayers(s, 0).filter((q) => q.id !== p.id);
      s.controlled =
        choices.sort((a, b) => distance(a, s.ball) - distance(b, s.ball))[0]
          ?.id ?? p.id;
    }
  }
  const controlled = s.players[s.controlled];
  if (s.ball.owner === controlled.id) {
    if (input.pass) {
      const target = passTarget(s, controlled, input);
      if (target) makePass(s, controlled, target, input.turbo);
    }
    if (input.shoot && !s.prevShoot && controlled.cooldown <= 0)
      controlled.charge = 0.001;
    if (
      controlled.charge !== null &&
      ((!input.shoot && s.prevShoot) || controlled.charge >= TUNE.maxCharge)
    )
      releaseShot(s, controlled, controlled.charge, input.turbo);
  } else {
    if (input.pass && s.possession !== 0) attemptSteal(s, controlled);
    if (input.shoot && !s.prevShoot) jump(s, controlled);
  }
  s.prevShoot = input.shoot;
}
export function stepGame(
  s: ArcadeState,
  input: ArcadeInput = NO_INPUT,
  dt: number = TUNE.step,
) {
  if (s.paused || s.phase === "break" || s.phase === "final") return;
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30);
  const safe = {
    ...input,
    moveX: Number.isFinite(input.moveX) ? input.moveX : 0,
    moveY: Number.isFinite(input.moveY) ? input.moveY : 0,
  };
  s.tick++;
  s.phaseTime += dt;
  s.messageTime = Math.max(0, s.messageTime - dt);
  if (s.phase === "tipoff") {
    s.ball.x = 14;
    s.ball.y = 7.5;
    s.ball.z = 1 + Math.sin(Math.min(1, s.phaseTime / 1.8) * Math.PI) * 3;
    if (safe.shoot && !s.prevShoot && s.tipTiming === null)
      s.tipTiming = Math.abs(s.phaseTime - 0.9);
    s.prevShoot = safe.shoot;
    if (s.phaseTime >= 1.8) {
      const timing =
        s.tipTiming === null ? 0 : Math.max(0, 1 - s.tipTiming / 0.9);
      const edge =
        (s.players[4].attributes.vertical - s.players[12].attributes.vertical) *
        0.002;
      const winner: Side = random(s) < 0.3 + timing * 0.45 + edge ? 0 : 1;
      s.openingTeam = winner;
      formation(s, winner);
      const p = activePlayers(s, winner)[0];
      p.x = 14;
      p.y = 7.5;
      giveBall(s, p);
      s.phase = "live";
      s.phaseTime = 0;
      notify(s, "LET’S PLAY!");
    }
    return;
  }
  if (s.phase === "inbound") {
    if (s.ball.mode === "held") {
      const p = s.players[s.ball.owner!];
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (
        (p.team === 0 && safe.pass) ||
        s.phaseTime >= (p.team === 0 ? 5 : 1.1)
      ) {
        const target = passTarget(s, p, safe);
        if (target) makePass(s, p, target);
      }
    }
    const wasPass = s.ball.mode === "pass";
    advanceBall(s, dt);
    if (wasPass && s.ball.mode === "held") {
      s.phase = "live";
      s.phaseTime = 0;
    }
    s.prevShoot = safe.shoot;
    return;
  }
  const liveDt = Math.min(s.clock, dt);
  s.clock = Math.max(0, s.clock - dt);
  if (!(s.ball.mode === "loose" && s.ball.rimContact))
    s.shotClock = Math.max(0, s.shotClock - dt);
  s.elapsed += liveDt;
  for (const p of activePlayers(s)) p.stats.seconds += liveDt;
  for (const team of [0, 1] as Side[])
    if (s.fire[team] > 0) {
      s.fire[team] = Math.max(0, s.fire[team] - liveDt);
      if (s.fire[team] === 0) s.streak[team] = 0;
    }
  if (s.clock === 0) {
    if (s.ball.mode === "shot") s.pendingHorn = true;
    else {
      endPeriod(s);
      return;
    }
  }
  if (
    s.shotClock === 0 &&
    s.ball.mode !== "shot" &&
    !(s.ball.mode === "loose" && s.ball.rimContact) &&
    !s.pendingHorn
  ) {
    emit(s, { kind: "turnover", team: s.possession, player: s.ball.owner });
    notify(s, "SHOT CLOCK VIOLATION");
    inbound(s, other(s.possession));
    return;
  }
  if (!s.pendingHorn) {
    controls(s, safe);
    if (movePlayers(s, safe, dt)) {
      emit(s, { kind: "turnover", team: s.possession, player: s.ball.owner });
      notify(s, "OUT OF BOUNDS");
      inbound(s, other(s.possession));
      return;
    }
    s.aiTimer -= dt;
    if (s.aiTimer <= 0) {
      aiDecisions(s);
      s.aiTimer = 0.2 + random(s) * 0.25;
    }
  }
  const outcome = advanceBall(s, dt);
  if (outcome === "score") {
    if (s.pendingHorn) {
      endPeriod(s);
      return;
    }
    inbound(s, other(s.ball.lastTouch));
    return;
  }
  if (s.pendingHorn && s.ball.mode !== "shot") {
    endPeriod(s);
    return;
  }
}
