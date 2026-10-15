import { describe, expect, it } from 'vitest';
import { initialState, gameReducer } from './state';
import { POSITIONS } from './types';
export function completedState() {
 let state=initialState(14);
 for(const position of POSITIONS) state=gameReducer(state,{type:'PLACE',pokemonId:state.run.offerIds[0],position});
 return gameReducer(state,{type:'SIMULATE'});
}
describe('run state',()=>{
 it('blocks simulation until all five starters are drafted',()=>{const s=initialState(1);expect(gameReducer(s,{type:'SIMULATE'})).toBe(s);});
 it('records a season once and locks all roster edits',()=>{
  const s=completedState();expect(s.run.result?.games).toHaveLength(82);expect(s.records.spin.runs).toBe(1);expect(s.records.free.runs).toBe(0);
  expect(gameReducer(s,{type:'SIMULATE'})).toBe(s);
  expect(gameReducer(s,{type:'PLACE',pokemonId:25,position:'PG'})).toBe(s);
  expect(gameReducer(s,{type:'SWAP',first:'PG',second:'C'})).toBe(s);
  expect(gameReducer(s,{type:'REROLL'})).toBe(s);
 });
 it('starts a fresh draft while preserving mode-specific records',()=>{
  const s=completedState(),next=gameReducer(s,{type:'NEW_RUN',mode:'free',includeLegends:false,seed:99});
  expect(next.records).toEqual(s.records);expect(next.run.result).toBeNull();expect(Object.values(next.run.roster)).toEqual([null,null,null,null,null]);expect(next.run.mode).toBe('free');
 });
});
