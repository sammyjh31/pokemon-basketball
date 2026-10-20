import type { MoveId } from "./moveTypes";
import type { ComboId } from "./comboTypes";
export const COUNTER_IDS = [
  "contain-burst",
  "top-lock",
  "switch-deny",
  "disrupt-relay",
] as const;
export const COUNTER_COMBO_IDS = ["slip-and-seal", "reverse-relay"] as const;
export type CounterId = (typeof COUNTER_IDS)[number];
export type CounterComboId = (typeof COUNTER_COMBO_IDS)[number];
export const COUNTER_LABELS: Record<CounterId | CounterComboId, string> = {
  "contain-burst": "Contain the burst",
  "top-lock": "Deny the release",
  "switch-deny": "Switch and deny",
  "disrupt-relay": "Disrupt the relay",
  "slip-and-seal": "Slip and seal",
  "reverse-relay": "Reverse relay",
};
export interface MoveReads {
  moves: Partial<Record<MoveId, number>>;
  combos: Partial<Record<ComboId, number>>;
}
export interface CounterStats {
  responses: Partial<Record<CounterId, number>>;
  counterCombos: Partial<Record<CounterComboId, number>>;
}
export interface CounterPlan {
  id: CounterId;
  observations: number;
  confidence: number;
}
export interface CounterEvent {
  id: CounterId | CounterComboId;
  target: MoveId | ComboId;
  playerIds: string[];
  elapsedSeconds: number;
  confidence: number;
  /** Proportion of this activation's bonus suppressed/restored, not a promised stop. */
  adjustment: number;
  energySpent: number[];
}
