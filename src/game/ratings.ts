import { POKEMON_BY_ID } from '../data/pokemon';
import { POSITIONS, type Pokemon, type Attributes, type Position, type Roster, type TeamRatings } from './types';
export const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
export const ATTRIBUTE_LABELS: Record<keyof Attributes,string> = {
 shooting:'Shooting',playmaking:'Playmaking',finishing:'Finishing',perimeterDefense:'Perimeter defense',interiorDefense:'Interior defense',rebounding:'Rebounding',
};
export const ATTRIBUTE_WEIGHTS: Record<keyof Attributes,Record<string,number>> = {
 shooting:{specialAttack:.60,specialDefense:.25,speed:.15},
 playmaking:{specialAttack:.45,speed:.40,specialDefense:.15},
 finishing:{attack:.50,speed:.30,height:.20},
 perimeterDefense:{speed:.45,defense:.30,specialDefense:.25},
 interiorDefense:{defense:.45,hp:.25,height:.15,weight:.15},
 rebounding:{hp:.25,defense:.25,height:.30,weight:.20},
};
export const ATTRIBUTE_KEYS=Object.keys(ATTRIBUTE_WEIGHTS) as (keyof Attributes)[];
export const POSITION_WEIGHTS: Record<Position,number[]> = {
 PG:[.20,.45,.10,.20,0,.05],SG:[.45,.15,.20,.15,0,.05],SF:[.25,.15,.25,.15,.10,.10],PF:[.10,.05,.30,.05,.20,.30],C:[.05,.05,.20,.05,.35,.30],
};
export function attributes(mon:Pokemon):Attributes {
 const values:Record<string,number> = Object.fromEntries(Object.entries(mon.stats).map(([k,v])=>[k,clamp(100*v/160)]));
 values.height=clamp(100*Math.log1p(mon.heightM)/Math.log(4));
 values.weight=clamp(100*Math.log1p(mon.weightKg)/Math.log(251));
 return Object.fromEntries(ATTRIBUTE_KEYS.map(k=>[k,clamp(Object.entries(ATTRIBUTE_WEIGHTS[k]).reduce((sum,[key,w])=>sum+values[key]*w,0))])) as unknown as Attributes;
}
export function positionRating(mon:Pokemon,position:Position):number {
 const a=attributes(mon);return ATTRIBUTE_KEYS.reduce((sum,key,i)=>sum+a[key]*POSITION_WEIGHTS[position][i],0);
}
export function teamRatings(roster:Roster):TeamRatings {
 let offense=0,defense=0,filled=0;
 for(const position of POSITIONS) {
  const mon=POKEMON_BY_ID.get(roster[position]??-1);if(!mon)continue;
  const a=attributes(mon),fit=positionRating(mon,position);filled++;
  offense+=.75*(.35*a.shooting+.30*a.playmaking+.35*a.finishing)+.25*fit;
  defense+=.75*(.40*a.perimeterDefense+.35*a.interiorDefense+.25*a.rebounding)+.25*fit;
 }
 offense/=filled||1;defense/=filled||1;
 return {offense,defense,overall:(offense+defense)/2,filled,complete:filled===5};
}
