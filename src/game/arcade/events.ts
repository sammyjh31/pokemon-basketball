import type { ArcadeEvent, ArcadeState } from "./types";
export function emit(s: ArcadeState, e: Omit<ArcadeEvent, "id" | "time">) {
  const event = { ...e, id: s.events.length, time: s.elapsed, tick: s.tick };
  s.events.push(event);
  const p = e.player === null ? undefined : s.players[e.player];
  if (e.kind === "shot" && p) {
    p.stats.fga++;
    if (e.value === 3) p.stats.threePA++;
  }
  if (e.kind === "score" && p) {
    p.stats.points += e.value ?? 2;
    p.stats.fgm++;
    if (e.value === 3) p.stats.threePM++;
    s.score[e.team] += e.value ?? 2;
  }
  if (e.kind === "steal" && p) p.stats.steals++;
  if (e.kind === "block" && p) p.stats.blocks++;
  if (e.kind === "turnover" && p) p.stats.turnovers++;
  if (e.kind === "rebound" && p) {
    if (e.value === 1) p.stats.offensiveRebounds++;
    else p.stats.defensiveRebounds++;
  }
}
