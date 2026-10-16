import {expect,it} from 'vitest';
import {POKEMON_BY_ID} from '../data/pokemon';
import {playerProfile} from './playerProfile';
import {bodyProfile} from './bodyMatchups';
import type {Player} from './matchLineups';
import {createCourt, courtGeometry, moveToward, chooseScreenCoverage, applyScreenCoverage, resolveCourtPossession} from './courtPossession';
const actor=(id:number,shooting=65,weightKg=80):Player=>{
 const pokemon={...POKEMON_BY_ID.get(25)!,weightKg,heightM:1.5};
 const profile=structuredClone(playerProfile(pokemon));
 for(const key of Object.keys(profile.attributes))profile.attributes[key as keyof typeof profile.attributes]=65;
 profile.attributes.threePoint=shooting;
 return {profile,body:bodyProfile(pokemon),energy:100,types:['normal'],typeEdges:new Map(),target:30,consecutive:0,box:{playerId:String(id),pokemonId:25,teamId:id<5?0:1} as Player['box']};
};
const setup=()=>{
 const offense=Array.from({length:5},(_,i)=>actor(i));
 const defense=Array.from({length:5},(_,i)=>actor(i+5));
 return {offense,defense,guards:new Map(offense.map((p,i)=>[p,defense[i]])),handler:offense[0],screener:offense[4],play:'pickRoll' as const,tactic:'balanced' as const,scheme:'man' as const,shotClock:24,periodRemaining:720};
};
it('crowded paint and a nearby defender produce harder shots than separated spacing',()=>{
 const c=setup(), court=createCourt(c);
 const shooter=c.offense[0];
 court.get(shooter)!.x=0;court.get(shooter)!.y=7;
 for(const p of c.defense){court.get(p)!.x=20;court.get(p)!.y=30;}
 const open=courtGeometry(court,shooter,c.offense,c.defense);
 court.get(c.defense[0])!.x=1;court.get(c.defense[0])!.y=8;
 court.get(c.defense[1])!.x=-3;court.get(c.defense[1])!.y=9;
 const closed=courtGeometry(court,shooter,c.offense,c.defense);
 expect(closed.defenderDistance).toBeLessThan(open.defenderDistance);
 expect(closed.shotLogOdds).toBeLessThan(open.shotLogOdds);
 expect(closed.paintCrowding).toBeGreaterThan(open.paintCrowding);
});
it('body inertia and fatigue limit actual recovery distance',()=>{
 const light=actor(0,65,20),heavy=actor(1,65,400);
 const a=moveToward({x:0,y:0},{x:20,y:0},light,.5);
 const b=moveToward({x:0,y:0},{x:20,y:0},heavy,.5);
 expect(a.x).toBeGreaterThan(b.x);
 light.energy=25;
 expect(moveToward({x:0,y:0},{x:20,y:0},light,.5).x).toBeLessThan(a.x);
 expect(moveToward({x:0,y:0},{x:2,y:0},heavy,10)).toEqual({x:2,y:0});
});
it('under concedes pullup room; trapping brings two defenders to the ball and exposes the roller',()=>{
 const c=setup(),under=createCourt(c),trap=createCourt(c);
 applyScreenCoverage(under,c,'under');applyScreenCoverage(trap,c,'trap');
 const u=courtGeometry(under,c.handler,c.offense,c.defense),t=courtGeometry(trap,c.handler,c.offense,c.defense);
 expect(u.defenderDistance).toBeGreaterThan(t.defenderDistance);
 expect(courtGeometry(trap,c.screener,c.offense,c.defense).defenderDistance).toBeGreaterThan(courtGeometry(under,c.screener,c.offense,c.defense).defenderDistance);
});
it('coaches consider shooting threat and mobility when selecting coverage',()=>{
 const c=setup();c.handler.profile.attributes.threePoint=30;
 expect(chooseScreenCoverage(c).coverage).toBe('under');
 c.handler.profile.attributes.threePoint=95;
 expect(chooseScreenCoverage(c).coverage).not.toBe('under');
 expect(chooseScreenCoverage({...c,scheme:'press'}).coverage).toBe('trap');
});
it('uses available time, preserves ten actual positions and terminates short-period and rebound possessions',()=>{
 for(const [clock,remaining] of [[24,720],[14,50],[24,.3],[14,1]]) {
  const c=setup(),r=resolveCourtPossession({...c,shotClock:clock,periodRemaining:remaining},()=>.6);
  expect(r.sequence.seconds).toBeLessThanOrEqual(Math.min(clock,remaining));
  expect(r.sequence.seconds).toBeGreaterThan(0);
  expect(r.sequence.actions.length).toBeLessThanOrEqual(9);
  expect(r.sequence.shotClock).toBeGreaterThanOrEqual(0);
  expect(r.sequence.positions).toHaveLength(10);
  expect(r.sequence.positions.every(p=>p.x>=-25&&p.x<=25&&p.y>=0&&p.y<=47)).toBe(true);
 }
});
