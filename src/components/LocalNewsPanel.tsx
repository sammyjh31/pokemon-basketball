import { useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { buildLeagueNews, localNewsSources } from "../game/leagueNews";
import { teamsWithMastery } from "../game/abilityMastery";
import { restoreLocalTeams } from "../game/localCareer";
import { localLeagueTeams, type LocalLeague } from "../game/localLeague";
import type { LeagueGameSummary, LeagueResult } from "../game/types";
import type { Playoffs } from "../game/playoffTypes";
import { LeagueNewsPanel } from "./LeagueNewsPanel";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { FranchiseDetailDialog } from "./FranchiseDetailDialog";
import { ScoutReport } from "./ScoutReport";
import { MasteryPanel } from "./MasteryPanel";
export function LocalNewsPanel({
  draft,
  league,
  playoffs,
}: {
  draft: LocalLeague;
  league?: LeagueResult | null;
  playoffs?: Playoffs | null;
}) {
  const [player, setPlayer] = useState<{ id: number; year: number } | null>(
      null,
    ),
    [game, setGame] = useState<LeagueGameSummary | null>(null);
  const year = draft.career?.year ?? 1;
  const current = player?.year === year;
  const archive = draft.career?.history.find((h) => h.year === player?.year);
  const teams = current
    ? draft.career?.phase === "offseason"
      ? draft.career.teams
      : teamsWithMastery(
          league?.teams ?? localLeagueTeams(draft),
          playoffs?.abilityMastery ?? league?.abilityMastery,
        )
    : archive
      ? restoreLocalTeams(archive.teams)
      : [];
  const team = teams.find((t) =>
    Object.values(t.roster).includes(player?.id ?? -1),
  );
  const mon = player && POKEMON_BY_ID.get(player.id);
  return (
    <>
      <LeagueNewsPanel
        stories={buildLeagueNews(localNewsSources(draft, league, playoffs))}
        yourTeamIds={draft.managers.map((m) => m.teamId)}
        onPlayer={(id, year) => setPlayer({ id, year })}
        canOpenGame={(_, storyYear) =>
          !!league && draft.career?.phase !== "offseason" && storyYear === year
        }
        onGame={(id) =>
          setGame(
            [
              ...(league?.games ?? []),
              ...(playoffs?.series.flatMap((s) => s.games) ?? []),
            ].find((g) => g.id === id) ?? null,
          )
        }
      />
      {game && league && (
        <LeagueBoxScore
          game={game}
          teams={league.teams}
          match={playoffs?.playedGames?.[game.id]?.match}
          onClose={() => setGame(null)}
        />
      )}
      {player && mon && (
        <FranchiseDetailDialog
          title={`${mon.name} · Year ${player.year}`}
          eyebrow={
            current
              ? "Current player profile"
              : "Archived season-opening roster"
          }
          onClose={() => setPlayer(null)}
        >
          <ScoutReport mon={mon} development={team?.development?.[mon.id]} />
          {team && (
            <MasteryPanel
              team={team}
              pokemonId={mon.id}
              historical={!current}
            />
          )}
        </FranchiseDetailDialog>
      )}
    </>
  );
}
