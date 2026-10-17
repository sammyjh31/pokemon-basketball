import { POKEMON_BY_ID } from "../../data/pokemon";
import {
  applyTypeShotEffect,
  typeMatchup,
  typeShotEffect,
} from "../typeMatchups";
import type { ArcadePlayer, ArcadeState } from "./types";
import {
  activePlayers,
  basket,
  clamp,
  distance,
  notify,
  other,
  random,
} from "./helpers";
import { TUNE } from "./tuning";
import { emit } from "./events";
import { applyArcadeAbilities } from "./abilities";
const typesOf = (p: ArcadePlayer) =>
  POKEMON_BY_ID.get(p.pokemonId)?.types ?? [p.type];

export function giveBall(
  s: ArcadeState,
  p: ArcadePlayer,
  gain?: "steal" | "defensiveRebound" | "offensiveRebound",
) {
  const changed = s.possession !== p.team;
  if (s.abilityVersion === 1) {
    if (changed || gain === "steal" || gain === "defensiveRebound")
      s.abilityPossession = {
        transitionAt:
          gain === "steal" || gain === "defensiveRebound" ? s.elapsed : null,
        secondChance: false,
      };
    else if (gain === "offensiveRebound")
      s.abilityPossession = { transitionAt: null, secondChance: true };
  }
  for (const q of s.players) q.charge = null;
  s.ball.mode = "held";
  s.ball.owner = p.id;
  s.ball.target = null;
  s.ball.lastTouch = p.team;
  s.ball.reboundOf = null;
  s.possession = p.team;
  if (changed) {
    s.shotClock = TUNE.possession;
    s.lastPass = null;
    s.passTarget = null;
  }
  if (p.team === 0) s.controlled = p.id;
  else if (changed)
    s.controlled = activePlayers(s, 0).sort(
      (a, b) => distance(a, p) - distance(b, p),
    )[0].id;
  s.ball.x = p.x;
  s.ball.y = p.y;
  s.ball.z = 1;
}
export function makePass(
  s: ArcadeState,
  p: ArcadePlayer,
  target: ArcadePlayer,
  lob = false,
) {
  if (
    s.ball.owner !== p.id ||
    !target.active ||
    target.team !== p.team ||
    p.id === target.id ||
    p.cooldown > 0
  )
    return;
  const lead = {
    x: clamp(target.x + target.vx * 0.12, 0.7, 27.3),
    y: clamp(target.y + target.vy * 0.12, 0.7, 14.3),
    z: 1,
  };
  const d = distance(p, lead);
  p.action = "pass";
  p.actionTime = 0.32;
  p.cooldown = 0.22;
  p.charge = null;
  Object.assign(s.ball, {
    mode: "pass",
    testedInterceptors: [],
    owner: null,
    from: p.id,
    target: target.id,
    start: { x: p.x, y: p.y, z: 1 },
    end: lead,
    travel: 0,
    duration: Math.max(0.15, d / (12 + p.attributes.passing * 0.07)),
    rimContact: false,
    lastTouch: p.team,
    lob: lob && distance(target, basket(s, p.team)) < 3.4,
    reboundOf: null,
  });
  s.passTarget = null;
  emit(s, { kind: "pass", team: p.team, player: p.id, target: target.id });
}
export function releaseShot(
  s: ArcadeState,
  p: ArcadePlayer,
  charge: number,
  turbo = false,
) {
  if (s.ball.owner !== p.id || s.ball.mode !== "held" || p.cooldown > 0) return;
  const rim = basket(s, p.team),
    d = distance(p, rim),
    defenders = activePlayers(s, other(p.team));
  const closest = Math.min(10, ...defenders.map((e) => distance(e, p)));
  const dunk = turbo && p.energy > 12 && d < TUNE.dunkRange && closest > 0.6;
  const value = d > TUNE.three ? 3 : 2;
  if (s.official)
    s.ball.officialZone = value === 3 ? "three" : d < 3 ? "rim" : "mid";
  const skill =
    d < 3
      ? p.attributes.finishing
      : value === 3
        ? p.attributes.threePoint
        : p.attributes.midRange;
  const timing = 1 - clamp(Math.abs(charge - TUNE.idealRelease) / 0.65, 0, 1);
  const contest = defenders.reduce(
    (sum, e) =>
      sum +
      (Math.max(0, 2.3 - distance(e, p)) / 2.3) *
        (0.14 + e.attributes.perimeterDefense * 0.0013),
    0,
  );
  const chance = clamp(
    0.17 +
      skill * 0.0055 +
      timing * 0.2 -
      Math.max(0, d - 5) * 0.027 -
      contest -
      (100 - p.energy) * 0.001 +
      (dunk ? 0.15 : 0) +
      (s.fire[p.team] > 0 ? 0.1 : 0),
    0.04,
    0.95,
  );
  const nearest = defenders.reduce<ArcadePlayer | undefined>(
    (best, defender) =>
      !best || distance(defender, p) < distance(best, p) ? defender : best,
    undefined,
  );
  const matchup =
    s.typeMatchupsVersion === 1 && nearest && closest < 3
      ? typeShotEffect(
          typesOf(p),
          typesOf(nearest),
          d < 3 ? "rim" : value === 3 ? "three" : "mid",
        )
      : undefined;
  const typedChance = matchup
    ? clamp(
        applyTypeShotEffect(chance, matchup.logOdds * (1 - closest / 3)),
        0.04,
        0.95,
      )
    : chance;
  const adjustedChance = applyArcadeAbilities(
    s,
    p,
    nearest,
    d < 3 ? "rim" : value === 3 ? "three" : "mid",
    typedChance,
  );
  const made = random(s) < adjustedChance;
  const end = { x: rim.x, y: rim.y, z: 2.6 };
  Object.assign(s.ball, {
    mode: "shot",
    owner: null,
    from: p.id,
    target: null,
    start: { x: p.x, y: p.y, z: 1.5 },
    end,
    travel: 0,
    duration: dunk ? 0.48 : clamp(0.65 + d * 0.035, 0.65, 1.25),
    releaseTime: s.elapsed,
    rimContact: false,
    shotValue: value,
    made,
    dunk,
    lob: false,
    reboundOf: p.team,
    lastTouch: p.team,
  });
  p.charge = null;
  p.action = dunk ? "dunk" : "shoot";
  p.actionTime = 0.65;
  p.jumpTime = TUNE.jump;
  p.cooldown = 0.55;
  if (dunk) p.energy = Math.max(0, p.energy - 10);
  emit(s, {
    kind: "shot",
    team: p.team,
    player: p.id,
    value,
    ...(s.official ? { zone: s.ball.officialZone } : {}),
  });
  notify(
    s,
    matchup && matchup.edge !== 0
      ? `${matchup.edge > 0 ? "TYPE ADVANTAGE" : "TYPE RESISTED"} · ${matchup.attackType?.toUpperCase()}`
      : dunk
        ? "TO THE RIM!"
        : timing > 0.9
          ? "GREAT RELEASE"
          : timing > 0.55
            ? "GOOD RELEASE"
            : "EARLY / LATE",
  );
}
export function attemptSteal(s: ArcadeState, p: ArcadePlayer) {
  if (p.cooldown > 0) return;
  p.cooldown = TUNE.stealCooldown;
  p.action = "steal";
  p.actionTime = 0.3;
  const holder = s.ball.owner === null ? undefined : s.players[s.ball.owner];
  if (!holder || holder.team === p.team || distance(p, holder) > 1.15) return;
  const chance = clamp(
    0.32 +
      (p.attributes.steal - holder.attributes.ballHandling) * 0.004 +
      (s.typeMatchupsVersion === 1
        ? typeMatchup(typesOf(p), typesOf(holder)).edge * 0.025
        : 0),
    0.1,
    0.7,
  );
  if (random(s) < chance) {
    emit(s, { kind: "turnover", team: holder.team, player: holder.id });
    emit(s, { kind: "steal", team: p.team, player: p.id });
    giveBall(s, p, "steal");
    notify(s, `${p.name.toUpperCase()} · STEAL!`);
  }
}
export function jump(s: ArcadeState, p: ArcadePlayer) {
  if (p.cooldown > 0 || p.jumpTime > 0) return;
  p.jumpTime = TUNE.jump;
  p.cooldown = TUNE.blockCooldown;
  p.action = "block";
  p.actionTime = TUNE.jump;
}
export function advanceBall(
  s: ArcadeState,
  dt: number,
): "score" | "miss" | null {
  const b = s.ball;
  if (b.mode === "held") {
    const p = b.owner === null ? null : s.players[b.owner];
    if (p) {
      b.x = p.x + p.facing * 0.3;
      b.y = p.y;
      b.z = 0.5 + Math.abs(Math.sin(s.elapsed * 15)) * 0.6;
    }
    return null;
  }
  if (b.mode === "pass" || b.mode === "shot") {
    b.travel += dt;
    const t = clamp(b.travel / b.duration, 0, 1);
    b.x = b.start.x + (b.end.x - b.start.x) * t;
    b.y = b.start.y + (b.end.y - b.start.y) * t;
    b.z =
      b.start.z +
      (b.end.z - b.start.z) * t +
      Math.sin(Math.PI * t) *
        (b.mode === "shot" ? (b.dunk ? 0.7 : 3.2) : b.lob ? 2.7 : 0.35);
    const from = b.from === null ? undefined : s.players[b.from];
    if (from && b.travel > 0.12) {
      const defenders = activePlayers(s, other(from.team));
      if (b.mode === "pass") {
        const candidate = defenders.find(
          (p) =>
            distance(p, b) < 0.55 &&
            b.z < 1.7 &&
            !b.testedInterceptors?.includes(p.id),
        );
        if (candidate) (b.testedInterceptors ??= []).push(candidate.id);
        const interceptor =
          candidate &&
          random(s) <
            clamp(
              0.18 +
                candidate.attributes.steal * 0.004 -
                from.attributes.passing * 0.002 +
                (s.typeMatchupsVersion === 1
                  ? typeMatchup(typesOf(candidate), typesOf(from)).edge * 0.02
                  : 0),
              0.1,
              0.65,
            )
            ? candidate
            : undefined;
        if (interceptor) {
          emit(s, { kind: "turnover", team: from.team, player: from.id });
          emit(s, {
            kind: "steal",
            team: interceptor.team,
            player: interceptor.id,
          });
          giveBall(s, interceptor, "steal");
          notify(s, "INTERCEPTED!");
          return null;
        }
      } else {
        const blocker = defenders.find(
          (p) =>
            p.jumpTime > 0 &&
            p.action === "block" &&
            distance(p, b) < 0.9 &&
            p.z + 1.5 >= b.z,
        );
        if (blocker) {
          emit(s, { kind: "block", team: blocker.team, player: blocker.id });
          b.mode = "loose";
          b.owner = null;
          b.z = 0.8;
          b.lastTouch = blocker.team;
          b.end = {
            x: clamp(b.x + (random(s) - 0.5) * 2, 0.5, 27.5),
            y: clamp(b.y + (random(s) - 0.5) * 2, 0.5, 14.5),
            z: 0,
          };
          notify(s, "REJECTED!");
          return "miss";
        }
      }
    }
    if (t >= 1) {
      if (b.mode === "pass") {
        const receiver = b.target === null ? undefined : s.players[b.target];
        if (receiver?.active && distance(receiver, b) < 2.2) {
          const lob = b.lob;
          giveBall(s, receiver);
          s.lastPass = from
            ? { from: from.id, to: receiver.id, time: s.elapsed }
            : null;
          if (lob) {
            releaseShot(s, receiver, TUNE.idealRelease, true);
            notify(s, "ALLEY-OOP!");
          }
        } else {
          b.mode = "loose";
          b.owner = null;
          b.z = 0.2;
          b.reboundOf = null;
          s.lastPass = null;
        }
      } else if (from) {
        if (b.made) {
          emit(s, {
            kind: "score",
            team: from.team,
            player: from.id,
            value: b.shotValue,
            ...(s.official ? { zone: b.officialZone } : {}),
          });
          if (
            s.lastPass?.to === from.id &&
            (b.releaseTime ?? s.elapsed) - s.lastPass.time <= 3
          )
            s.players[s.lastPass.from].stats.assists++;
          s.lastPass = null;
          s.streak[other(from.team)] = 0;
          s.fire[other(from.team)] = 0;
          if (s.fire[from.team] <= 0) {
            s.streak[from.team]++;
            if (s.streak[from.team] >= 3) {
              s.fire[from.team] = 10;
              notify(s, "ELEMENTAL HEAT!");
            }
          }
          if (s.fire[from.team] <= 0)
            notify(
              s,
              b.dunk
                ? "BOOM!"
                : b.shotValue === 3
                  ? "FROM DOWNTOWN!"
                  : "BUCKET!",
            );
          b.mode = "loose";
          b.owner = null;
          return "score";
        }
        b.mode = "loose";
        b.owner = null;
        b.z = 0.8;
        b.x = clamp(b.x + (random(s) - 0.5) * 4, 1, 27);
        b.y = clamp(b.y + (random(s) - 0.5) * 4, 1, 14);
        b.rimContact = true;
        notify(s, "OFF THE RIM");
        return "miss";
      }
    }
  } else {
    b.z = Math.max(0, b.z - dt * 3);
    if (b.z < 0.9) {
      const candidates = activePlayers(s).filter(
        (p) =>
          distance(p, b) < TUNE.pickup + p.attributes.rebounding * 0.002 &&
          p.cooldown < 0.5,
      );
      candidates.sort(
        (a, c) =>
          distance(a, b) -
          distance(c, b) -
          (a.z - c.z) * 0.2 -
          (a.attributes.rebounding - c.attributes.rebounding) * 0.002,
      );
      if (candidates[0]) {
        const p = candidates[0];
        if (b.reboundOf !== null)
          emit(s, {
            kind: "rebound",
            team: p.team,
            player: p.id,
            value: p.team === b.reboundOf ? 1 : 0,
          });
        const reset =
          s.possession !== p.team ||
          (b.reboundOf !== null && b.rimContact === true);
        giveBall(
          s,
          p,
          b.reboundOf === null
            ? undefined
            : p.team === b.reboundOf
              ? "offensiveRebound"
              : "defensiveRebound",
        );
        s.lastPass = null;
        if (reset) s.shotClock = TUNE.possession;
      }
    }
  }
  return null;
}
