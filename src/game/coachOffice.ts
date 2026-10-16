import {
  COACHES,
  getCoach,
  type CoachAssignment,
  type TrainerCoach,
} from "./trainerCoaches";
import { playerProfile } from "./playerProfile";
import { POKEMON_BY_ID } from "../data/pokemon";
import { nextRandom } from "./random";
import type { LeagueTeam, Standing } from "./types";
import type { CoachSeasonRecord } from "./coachCareers";

export interface CoachChange {
  teamId: number;
  from: string | null;
  to: string | null;
  source: "user" | "cpu";
  reason: string;
}
export interface CoachOffseason {
  year: number;
  baseline: (string | null)[];
  changes: CoachChange[];
  cpuProcessed: boolean;
}
export interface CoachOffice {
  version: 1;
  years: CoachOffseason[];
}
const fail = (message = "Invalid saved coaching office."): never => {
  throw new Error(message);
};
export const coachIds = (teams: Pick<LeagueTeam, "coach">[]) =>
  teams.map((t) => t.coach?.id ?? null);
export function officeAssignments(row: CoachOffseason): (string | null)[] {
  const ids = [...row.baseline];
  for (const change of row.changes) {
    if (
      ids[change.teamId] !== change.from ||
      (change.to && ids.includes(change.to))
    )
      fail();
    ids[change.teamId] = change.to;
  }
  return ids;
}
export function projectedCoaches(
  teams: LeagueTeam[],
  office: CoachOffice | undefined,
  year: number,
): LeagueTeam[] {
  const row = office?.years.find((r) => r.year === year);
  if (!row) return teams;
  const ids = officeAssignments(row);
  return teams.map((team, i) => {
    const { coach: _, ...base } = team;
    return {
      ...base,
      ...(ids[i]
        ? { coach: { version: 1, id: ids[i] } as CoachAssignment }
        : {}),
    };
  });
}
function prepare(
  office: CoachOffice | undefined,
  teams: LeagueTeam[],
  year: number,
): CoachOffice {
  const next: CoachOffice = structuredClone(
    office ?? { version: 1, years: [] },
  );
  if (!next.years.some((r) => r.year === year))
    next.years.push({
      year,
      baseline: coachIds(teams),
      changes: [],
      cpuProcessed: false,
    });
  return next;
}
function append(office: CoachOffice, year: number, change: CoachChange) {
  const row = office.years.find((r) => r.year === year)!;
  if (
    row.changes.length >= 200 ||
    office.years.reduce((n, r) => n + r.changes.length, 0) >= 10000
  )
    fail("The coaching transaction limit has been reached.");
  row.changes.push(change);
}
export function changeCoach(
  office: CoachOffice | undefined,
  teams: LeagueTeam[],
  year: number,
  teamId: number,
  id: string | null,
  humanTeamIds: number[],
): CoachOffice {
  if (!humanTeamIds.includes(teamId) || !teams[teamId])
    fail("Choose a human-managed club.");
  if (id !== null && !getCoach(id)) fail("Choose a known trainer.");
  const next = prepare(office, teams, year),
    row = next.years.find((r) => r.year === year)!,
    ids = officeAssignments(row);
  if (id === ids[teamId]) fail("That trainer already holds this job.");
  if (id && ids.includes(id))
    fail("Choose an available trainer; employed coaches cannot be hired.");
  append(next, year, {
    teamId,
    from: ids[teamId],
    to: id,
    source: "user",
    reason: id
      ? "Manager appointed a new head coach for next season."
      : "Manager released the head coach to the hiring market.",
  });
  return next;
}
export function coachRosterFit(team: LeagueTeam, coach: TrainerCoach): number {
  const profiles = Object.values(team.roster).flatMap((id) => {
    const mon = POKEMON_BY_ID.get(id!);
    return mon ? [playerProfile(mon, team.development?.[mon.id])] : [];
  });
  if (!profiles.length) return 0;
  const score =
    profiles.reduce((n, p) => {
      const a = p.attributes;
      const attack = {
        balanced: (a.passing + a.composure) / 2,
        pace: (a.speed + a.stamina + a.ballHandling) / 3,
        perimeter: (a.threePoint * 2 + a.passing) / 3,
        interior: (a.finishing + a.strength + a.rebounding) / 3,
        defense: (a.perimeterDefense + a.interiorDefense) / 2,
      }[coach.tactic];
      const defense =
        coach.defense === "press"
          ? (a.speed + a.stamina + a.perimeterDefense) / 3
          : coach.defense === "zone"
            ? (a.interiorDefense + a.rebounding) / 2
            : (a.perimeterDefense + a.interiorDefense + a.speed) / 3;
      return n + attack * 0.65 + defense * 0.35;
    }, 0) / profiles.length;
  return Math.round(score * 10) / 10;
}
export interface CpuCoachReview {
  teams: LeagueTeam[];
  standings: Standing[];
  year: number;
  seed: number;
  humanTeamIds: number[];
  championId: number;
  finalistIds: number[];
  priorRecords: CoachSeasonRecord[];
}
export function reviewCpuCoaches(
  office: CoachOffice | undefined,
  input: CpuCoachReview,
): CoachOffice {
  const { teams, standings, year, humanTeamIds, priorRecords } = input;
  if (office?.years.find((r) => r.year === year)?.cpuProcessed) return office;
  const next = prepare(office, teams, year),
    row = next.years.find((r) => r.year === year)!;
  row.cpuProcessed = true;
  const assigned = projectedCoaches(teams, next, year);
  if (!teams.every((t) => t.coach)) return next;
  const strength = teams.map((t) => {
    const players = Object.values(t.roster).map((id) =>
      playerProfile(POKEMON_BY_ID.get(id!)!, t.development?.[id!]),
    );
    return (
      players.reduce((n, p) => n + Math.max(...Object.values(p.positions)), 0) /
      8
    );
  });
  const average = strength.reduce((a, b) => a + b, 0) / teams.length;
  const candidates = assigned
    .flatMap((t) => {
      if (
        humanTeamIds.includes(t.id) ||
        input.finalistIds.includes(t.id) ||
        t.id === input.championId ||
        !t.coach
      )
        return [];
      const result = standings.find((s) => s.teamId === t.id);
      if (!result) return [];
      const pct = result.wins / Math.max(1, result.wins + result.losses);
      const expected = Math.max(
        0.25,
        Math.min(0.75, 0.5 + (strength[t.id] - average) * 0.025),
      );
      const prior = priorRecords
        .filter(
          (r) =>
            r.teamId === t.id && r.coachId === t.coach!.id && r.year < year,
        )
        .sort((a, b) => b.year - a.year)[0];
      const repeat =
        prior && prior.wins / Math.max(1, prior.wins + prior.losses) < 0.4;
      const pressure = expected - pct + (repeat ? 0.12 : 0);
      if (pressure < 0.1 && pct >= 0.32) return [];
      const reason = `${result.wins}–${result.losses} against a ${Math.round(expected * 100)}% roster expectation${repeat ? "; consecutive losing seasons" : ""}. Seeking a better roster fit.`;
      return [{ teamId: t.id, pressure, reason, old: t.coach.id }];
    })
    .sort((a, b) => b.pressure - a.pressure || a.teamId - b.teamId)
    .slice(0, Math.max(1, Math.floor(teams.length / 5)));
  for (const c of candidates)
    append(next, year, {
      teamId: c.teamId,
      from: c.old,
      to: null,
      source: "cpu",
      reason: c.reason,
    });
  for (const c of candidates) {
    const taken = officeAssignments(row),
      team = teams[c.teamId];
    const pool = COACHES.filter(
      (coach) => coach.id !== c.old && !taken.includes(coach.id),
    );
    const rated = pool
      .map((coach, i) => {
        const past = priorRecords.filter((r) => r.coachId === coach.id),
          games = past.reduce((n, r) => n + r.wins + r.losses, 0);
        const wins = past.reduce((n, r) => n + r.wins, 0),
          titles = past.filter((r) => r.champion).length;
        const reputation = games
          ? (wins / games - 0.5) * 5 + Math.min(2, titles * 0.5)
          : 0;
        return {
          coach,
          fit: coachRosterFit(team, coach),
          score:
            coachRosterFit(team, coach) +
            reputation +
            nextRandom(
              (input.seed ^
                Math.imul(c.teamId + 1, 91) ^
                Math.imul(i + 1, 131)) >>>
                0,
            ).value *
              0.5,
        };
      })
      .sort(
        (a, b) => b.score - a.score || a.coach.id.localeCompare(b.coach.id),
      );
    const best = rated[0];
    if (!best) fail("No available coach for a CPU vacancy.");
    append(next, year, {
      teamId: c.teamId,
      from: null,
      to: best.coach.id,
      source: "cpu",
      reason: `Hired ${best.coach.name}: ${best.coach.style}; roster fit ${best.fit.toFixed(1)}. ${c.reason}`,
    });
  }
  return next;
}
export function validateCoachOffice(
  value: unknown,
  teamCount: number,
  maxYear: number,
  humanIds: number[],
): CoachOffice {
  if (!value || typeof value !== "object") return fail();
  const v = value as CoachOffice;
  if (v.version !== 1 || !Array.isArray(v.years) || v.years.length > maxYear)
    return fail();
  let previous = 0,
    total = 0;
  const years = v.years.map((raw) => {
    if (
      !raw ||
      !Number.isSafeInteger(raw.year) ||
      raw.year <= previous ||
      raw.year > maxYear ||
      typeof raw.cpuProcessed !== "boolean" ||
      !Array.isArray(raw.baseline) ||
      raw.baseline.length !== teamCount ||
      !Array.isArray(raw.changes) ||
      raw.changes.length > 200
    )
      return fail();
    previous = raw.year;
    total += raw.changes.length;
    if (total > 10000) return fail();
    const baseline = raw.baseline.map((id) =>
      id === null ? null : typeof id === "string" && getCoach(id) ? id : fail(),
    );
    const occupied = baseline.filter(Boolean);
    if (
      new Set(occupied).size !== occupied.length ||
      (occupied.length !== 0 && occupied.length !== teamCount)
    )
      return fail();
    const changes = raw.changes.map((c) => {
      if (
        !c ||
        !Number.isSafeInteger(c.teamId) ||
        c.teamId < 0 ||
        c.teamId >= teamCount ||
        !["user", "cpu"].includes(c.source) ||
        (c.source === "user") !== humanIds.includes(c.teamId) ||
        (c.source === "cpu" && !raw.cpuProcessed) ||
        typeof c.reason !== "string" ||
        !c.reason.length ||
        c.reason.length > 300 ||
        c.from === c.to ||
        (c.from !== null &&
          (typeof c.from !== "string" || !getCoach(c.from))) ||
        (c.to !== null && (typeof c.to !== "string" || !getCoach(c.to)))
      )
        return fail();
      return {
        teamId: c.teamId,
        from: c.from,
        to: c.to,
        source: c.source,
        reason: c.reason,
      };
    });
    const row = {
      year: raw.year,
      baseline,
      changes,
      cpuProcessed: raw.cpuProcessed,
    };
    const final = officeAssignments(row);
    if (
      raw.cpuProcessed &&
      occupied.length &&
      final.some((id, i) => !id && !humanIds.includes(i))
    )
      return fail();
    return row;
  });
  return { version: 1, years };
}
export function verifyCoachBaseline(
  row: CoachOffseason | undefined,
  teams: Pick<LeagueTeam, "coach">[],
) {
  if (row && JSON.stringify(row.baseline) !== JSON.stringify(coachIds(teams)))
    fail("Coaching appointments do not match this season's coaches.");
}

/** Compare season boundaries while allowing legacy leagues to adopt coaches once. */
export function verifyCoachChronology(
  office: CoachOffice | undefined,
  seasons: { year: number; teams: Pick<LeagueTeam, "coach">[] }[],
) {
  for (const season of seasons) {
    const row = office?.years.find((r) => r.year === season.year);
    verifyCoachBaseline(row, season.teams);
    const next = seasons.find((s) => s.year === season.year + 1);
    if (!next || !season.teams.some((t) => t.coach)) continue;
    const expected = row ? officeAssignments(row) : coachIds(season.teams);
    if (JSON.stringify(expected) !== JSON.stringify(coachIds(next.teams)))
      fail("A coach changed without an offseason appointment.");
  }
}
