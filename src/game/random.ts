/** A pure Mulberry32 step: state travels with the run, never with animations. */
export function nextRandom(seed:number):{value:number;seed:number} {
 const next=(seed+0x6D2B79F5)>>>0;
 let t=Math.imul(next^(next>>>15),next|1);
 t^=t+Math.imul(t^(t>>>7),t|61);
 return {value:((t^(t>>>14))>>>0)/4294967296,seed:next};
}
