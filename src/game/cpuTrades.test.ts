import { describe, expect, it } from "vitest";
import { drafted } from "./cpuRules.testUtils";
import { rookieFixture } from "./rookieDraft.testUtils";
import { CPU_TRADE_ASKING_BASE, evaluateTradePackage } from "./tradeMarket";

describe("trade asking price under CPU rules", () => {
  it("raises the base asking price from -1.6 to -0.5 for governed offseasons", () => {
    const state = drafted(rookieFixture()),
      f = state.franchise!;
    const offer = {
      teamId: 3,
      giveIds: [f.teams[0].roster.PG!],
      receiveIds: [f.teams[3].roster.PG!],
    };
    const legacy = evaluateTradePackage(f, offer),
      governedOffer = evaluateTradePackage(
        { ...f, cpuRules: { modelVersion: 1, since: 1 } },
        offer,
      );
    expect(governedOffer.score).toBeCloseTo(legacy.score, 9);
    expect(governedOffer.threshold - legacy.threshold).toBeCloseTo(
      CPU_TRADE_ASKING_BASE + 1.6,
      9,
    );
  });
});
