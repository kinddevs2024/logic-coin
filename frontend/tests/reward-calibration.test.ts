import { describe, expect, it } from "vitest";
import { GAME_REWARD_TARGETS, gameCoinReward, questionRewardScore } from "../src/games/rewards";

describe("action-based game rewards", () => {
  it("starts every game at zero and maps its normal full-round target to 1000", () => {
    for (const [key, target] of Object.entries(GAME_REWARD_TARGETS)) {
      expect(gameCoinReward(0, false, key)).toBe(0);
      expect(gameCoinReward(target / 10, false, key)).toBe(100);
      expect(gameCoinReward(target, false, key)).toBe(1000);
      expect(gameCoinReward(target * 2, false, key)).toBeGreaterThan(1000);
    }
  });
  it("earns math coins only for correct answers without rounding drift", () => {
    expect(questionRewardScore(0, 15)).toBe(0);
    expect(questionRewardScore(1, 15)).toBe(67);
    expect(questionRewardScore(3, 15)).toBe(200);
    expect(questionRewardScore(15, 15)).toBe(1000);
    expect(gameCoinReward(questionRewardScore(3, 15), false, "math-quiz")).toBe(200);
  });
  it("keeps bottle hits at 50 and failed throws at zero", () => {
    expect(gameCoinReward(100, true, "bottle-flip")).toBe(50);
    expect(gameCoinReward(0, false, "bottle-flip")).toBe(0);
  });
  it("credits Light Code cleared rounds one-for-one even when the run ends on a mistake", () => {
    for (const score of [0, 100, 200, 300, 600, 900, 1000]) {
      expect(gameCoinReward(score, false, "light-sequence")).toBe(score);
      expect(gameCoinReward(score, true, "light-sequence")).toBe(score);
    }
  });
  it("caps Light Code coins while accepting scores from longer runs", () => {
    expect(gameCoinReward(1100, false, "light-sequence")).toBe(1000);
    expect(gameCoinReward(3000, true, "light-sequence")).toBe(1000);
    for (const score of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(gameCoinReward(score, false, "light-sequence")).toBe(0);
    }
  });
});
