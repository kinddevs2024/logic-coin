import { expect, it } from "vitest";
import { FORTUNE_WHEEL_PRIZES, fortuneWheelOutcome } from "../src/lib/fortune-wheel";

it("points to the actual server reward, especially +100 instead of a false +1000", () => {
  for (const amount of [200, 150, 100, 50]) {
    const outcome = fortuneWheelOutcome(`+${amount}`);
    expect(outcome.prizes[outcome.index]).toBe(`+${amount}`);
    expect((outcome.angle + outcome.index * 72 + 36) % 360).toBe(0);
  }
  expect(fortuneWheelOutcome("+100").index).toBe(3);
  expect(FORTUNE_WHEEL_PRIZES).not.toContain("+1000");
  expect(FORTUNE_WHEEL_PRIZES).not.toContain("+500");
});

it("displays a new server amount at the selected sector instead of substituting another prize", () => {
  const outcome = fortuneWheelOutcome("+300");
  expect(outcome.prizes[outcome.index]).toBe("+300");
  expect(fortuneWheelOutcome(null).prizes).toEqual(FORTUNE_WHEEL_PRIZES);
});
