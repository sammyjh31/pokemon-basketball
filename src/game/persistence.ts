import { POKEMON_BY_ID } from '../data/pokemon';
import { initialState } from './state';
import { simulateSeason } from './season';
import { POSITIONS, type GameState, type ModeRecords, type Roster, type Run } from './types';
export interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void}
export const STORAGE_KEY='pokemon-basketball:v1';
const fail=():never=>{throw new Error('Invalid saved game');};
function object(value:unknown):Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value))return fail();
 return value as Record<string,unknown>;
}
function integer(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)return fail();return value;
}
function records(value:unknown):ModeRecords {
 const row=object(value),runs=integer(row.runs),bestWins=integer(row.bestWins,0,82),perfectSeasons=integer(row.perfectSeasons,0,runs);
 if((runs===0&&bestWins!==0)||(perfectSeasons>0&&bestWins!==82)||(bestWins===82&&perfectSeasons===0))return fail();
 return {runs,bestWins,perfectSeasons};
}
function validate(value:unknown):GameState {
 const root=object(value);if(root.version!==1)return fail();
 const raw=object(root.run),source=object(raw.roster),history=object(root.records);
 if(raw.mode!=='spin'&&raw.mode!=='free')return fail();
 if(typeof raw.includeLegends!=='boolean'||typeof raw.id!=='string'||!/^run-\d{1,10}$/.test(raw.id))return fail();
 const roster={} as Roster;
 if(Object.keys(source).length!==5)return fail();
 for(const position of POSITIONS) {
  const id=source[position];if(id===null){roster[position]=null;continue;}
  const mon=POKEMON_BY_ID.get(integer(id,1,151));if(!mon||(!raw.includeLegends&&mon.legendary))return fail();
  roster[position]=mon.id;
 }
 const chosen=Object.values(roster).filter(id=>id!==null);
 if(new Set(chosen).size!==chosen.length||!Array.isArray(raw.offerIds))return fail();
 const offerIds=raw.offerIds.map(id=>integer(id,1,151));
 const expectedOffers=raw.mode==='spin'&&chosen.length<5?4:0;
 if(offerIds.length!==expectedOffers||new Set(offerIds).size!==offerIds.length||offerIds.some(id=>chosen.includes(id)||(!raw.includeLegends&&POKEMON_BY_ID.get(id)!.legendary)))return fail();
 const run:Run={id:raw.id,mode:raw.mode,includeLegends:raw.includeLegends,roster,offerIds,rerollsLeft:integer(raw.rerollsLeft,0,2),draftSeed:integer(raw.draftSeed,0,0xffffffff),seasonSeed:integer(raw.seasonSeed,0,0xffffffff),result:null};
 const parsedRecords={spin:records(history.spin),free:records(history.free)};
 if(raw.result!==null) {
  const result=object(raw.result);if(chosen.length!==5||!Array.isArray(result.games)||result.games.length!==82)return fail();
  // Replaying 82 deterministic results validates totals, scores, awards, and schedule together.
  const expected=simulateSeason(run);
  if(result.wins!==expected.wins||result.losses!==expected.losses||result.mvpId!==expected.mvpId)return fail();
  for(let i=0;i<82;i++) {
   const actual=object(result.games[i]);
   for(const [key,val] of Object.entries(expected.games[i]))if(actual[key]!==val)return fail();
  }
  const record=parsedRecords[run.mode];
  if(record.runs<1||record.bestWins<expected.wins||(expected.wins===82&&record.perfectSeasons<1))return fail();
  run.result=expected;
 }
 return {version:1,run,records:parsedRecords};
}
export function loadGame(storage:StorageLike,fallbackSeed:number):{state:GameState;notice:string|null} {
 let source:string|null;
 try {source=storage.getItem(STORAGE_KEY);}catch{return {state:initialState(fallbackSeed),notice:'Browser storage is unavailable. You can play, but progress will not be saved.'};}
 if(source===null)return {state:initialState(fallbackSeed),notice:null};
 try {return {state:validate(JSON.parse(source)),notice:null};}
 catch {return {state:initialState(fallbackSeed),notice:'Your saved game could not be restored. A fresh draft is ready.'};}
}
export function saveGame(storage:StorageLike,state:GameState):{saved:boolean;notice:string|null} {
 try {storage.setItem(STORAGE_KEY,JSON.stringify(state));return {saved:true,notice:null};}
 catch{return {saved:false,notice:'Browser storage is unavailable. You can play, but progress will not be saved.'};}
}
