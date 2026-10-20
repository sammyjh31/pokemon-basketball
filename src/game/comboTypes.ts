import type { PlayerTrainingPlan } from "./franchiseFeatures";
export const COMBO_IDS = [
  "pick-roll",
  "pick-pop",
  "drive-kick",
  "elemental-relay",
] as const;
export type ComboId = (typeof COMBO_IDS)[number];
export interface ComboAssignment {
  id: ComboId;
  initiatorId: number;
  partnerId: number;
  fit: number;
  chemistry: number;
  familiarity: number;
  mastery: number;
  unlocked: boolean;
  reasons: string[];
}
export interface ComboStats {
  attempts: Partial<Record<ComboId, number>>;
  shotsCreated: Partial<Record<ComboId, number>>;
}
export interface ComboEvent {
  id: ComboId;
  stage: "setup" | "shot";
  playerIds: [string, string];
  elapsedSeconds: number;
  chemistry: number;
  lineupChemistry: number;
  mastery: number;
  strength: number;
  energySpent: [number, number];
}
interface ComboPlay {
  id: ComboId;
  name: string;
  description: string;
  setup: "screen" | "pass" | "kickout";
  play: "pickRoll" | "spotUp" | "isolation";
  zones: readonly ("rim" | "mid" | "three")[];
  training: [PlayerTrainingPlan["focus"], PlayerTrainingPlan["focus"]];
}
export const comboPlays: readonly ComboPlay[] = [
  {
    id: "pick-roll",
    name: "Pick-and-roll",
    description: "Screen, pass to the roller and a rim attempt.",
    setup: "screen",
    play: "pickRoll",
    zones: ["rim"],
    training: ["playmaking", "position"],
  },
  {
    id: "pick-pop",
    name: "Pick-and-pop",
    description:
      "Screen, pass to the popper and a midrange or three-point attempt.",
    setup: "screen",
    play: "pickRoll",
    zones: ["mid", "three"],
    training: ["playmaking", "shooting"],
  },
  {
    id: "drive-kick",
    name: "Drive-and-kick",
    description:
      "A drive draws help, then a kickout creates a perimeter attempt.",
    setup: "kickout",
    play: "isolation",
    zones: ["mid", "three"],
    training: ["playmaking", "shooting"],
  },
  {
    id: "elemental-relay",
    name: "Elemental relay",
    description:
      "Complementary types coordinate a pass and the receiver's next shot.",
    setup: "pass",
    play: "spotUp",
    zones: ["rim", "mid", "three"],
    training: ["playmaking", "conditioning"],
  },
];
