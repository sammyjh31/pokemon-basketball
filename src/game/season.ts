import { OPPONENTS, SCHEDULE } from '../data/opponents';
import { POKEMON_BY_ID } from '../data/pokemon';
import { clamp, positionRating, teamRatings } from './ratings';
import { nextRandom } from './random';
import { POSITIONS, type GameResult, type Opponent, type Roster, type Run, type SeasonResult, type TeamRatings } from './types';

export const SEASON_RULES = { homeAdvantage:1.75, probabilityScale:9, minProbability:.01, maxProbability:.999 };
export function winProbability(team:TeamRatings,opponent:Opponent,home:boolean):number {
 const difference=((team.offense-opponent.defense)+(team.defense-opponent.offense))/2+(home?1:-1)*SEASON_RULES.homeAdvantage;
 return clamp(1/(1+Math.exp(-difference/SEASON_RULES.probabilityScale)),SEASON_RULES.minProbability,SEASON_RULES.maxProbability);
}
export function resolveScore(teamRegulation:number,opponentRegulation:number,won:boolean,seed:number):{teamScore:number;opponentScore:number;overtime:boolean;seed:number} {
 let high=Math.max(teamRegulation,opponentRegulation),low=Math.min(teamRegulation,opponentRegulation);
 const overtime=high===low;
 if(overtime) {
  const extra=nextRandom(seed),margin=nextRandom(extra.seed);seed=margin.seed;
  low+=6+Math.floor(extra.value*11);high=low+1+Math.floor(margin.value*8);
 }
 return {teamScore:won?high:low,opponentScore:won?low:high,overtime,seed};
}
export function seasonMvp(games:GameResult[],roster:Roster):number {
 const candidates=POSITIONS.map(position=>{
  const mon=POKEMON_BY_ID.get(roster[position]!)!;
  return {id:mon.id,awards:games.filter(g=>g.playerOfGameId===mon.id).length,rating:positionRating(mon,position)};
 });
 candidates.sort((a,b)=>b.awards-a.awards||b.rating-a.rating||a.id-b.id);
 return candidates[0].id;
}
export function simulateSeason(run:Run):SeasonResult {
 const team=teamRatings(run.roster);
 if(!team.complete||new Set(Object.values(run.roster)).size!==5)throw new Error('Draft five distinct starters first.');
 if(run.result)throw new Error('This roster has already played its season.');
 let seed=run.seasonSeed;
 const roll=()=>{const next=nextRandom(seed);seed=next.seed;return next.value;};
 const weights=POSITIONS.map(position=>({id:run.roster[position]!,weight:Math.max(1,positionRating(POKEMON_BY_ID.get(run.roster[position]!)!,position))**2}));
 const total=weights.reduce((sum,p)=>sum+p.weight,0);
 const games:GameResult[]=SCHEDULE.map(match=>{
  const opponent=OPPONENTS[match.opponentId-1];
  const probability=winProbability(team,opponent,match.home),won=roll()<probability;
  const teamRegulation=Math.max(40,Math.round(104+opponent.pace+.4*(team.offense-opponent.defense)+(roll()-.5)*32));
  const opponentRegulation=Math.max(40,Math.round(104+opponent.pace+.4*(opponent.offense-team.defense)+(roll()-.5)*32));
  const score=resolveScore(teamRegulation,opponentRegulation,won,seed);seed=score.seed;
  let award=roll()*total;
  const player=weights.find(p=>{award-=p.weight;return award<=0;})??weights[weights.length-1];
  return {...match,winProbability:probability,teamScore:score.teamScore,opponentScore:score.opponentScore,won,overtime:score.overtime,playerOfGameId:player.id};
 });
 const wins=games.filter(g=>g.won).length;
 return {games,wins,losses:82-wins,mvpId:seasonMvp(games,run.roster)};
}
