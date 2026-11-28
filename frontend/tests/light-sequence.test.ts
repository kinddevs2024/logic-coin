import { describe, expect, it } from "vitest";
import {
  createLightSequence,
  judgeLightSequenceInput,
  LIGHT_SEQUENCE_PAD_COUNT,
  LIGHT_SEQUENCE_START_LENGTH,
  lightSequenceResponseMs,
  lightSequenceScore,
} from "../src/games/light-sequence/round";

describe("light sequence rounds", () => {
  it("starts with two pads and draws every pad of a longer round again", () => {
    const samples = [0, 0.24, 0.25, 0.50, 1 - Number.EPSILON];
    const random = () => samples.shift() ?? Number.NaN;

    const first = createLightSequence(undefined, random);
    const second = createLightSequence(first.length + 1, random);

    expect(first).toEqual([0, 0]);
    expect(second).toEqual([1, 2, LIGHT_SEQUENCE_PAD_COUNT - 1]);
    expect(samples).toEqual([]);
  });

  it("rejects invalid lengths and random samples outside the supported range", () => {
    expect(() => createLightSequence(1)).toThrow(RangeError);
    expect(() => createLightSequence(2.5)).toThrow(RangeError);
    for (const sample of [-0.01, 1, Number.NaN]) {
      expect(() => createLightSequence(2, () => sample)).toThrow(RangeError);
    }
  });

  it("allows a double repeat and samples only the remaining pads on the next draw", () => {
    for (const repeatedPad of [0, 1, 2, 3]) {
      const remainingPads = [0, 1, 2, 3].filter(pad => pad !== repeatedPad);
      remainingPads.forEach((expectedPad, choice) => {
        const repeatedSample = (repeatedPad + 0.5) / LIGHT_SEQUENCE_PAD_COUNT;
        const samples = [repeatedSample, repeatedSample, (choice + 0.5) / remainingPads.length];
        const sequence = createLightSequence(3, () => samples.shift() ?? Number.NaN);

        expect(sequence).toEqual([repeatedPad, repeatedPad, expectedPad]);
        expect(samples).toEqual([]);
      });
    }
  });

  it("never needs to reroll a sample even with a constant random source", () => {
    let draws = 0;
    const sequence = createLightSequence(8, () => {
      draws += 1;
      return 0;
    });

    expect(sequence).toEqual([0, 0, 1, 0, 0, 1, 0, 0]);
    expect(draws).toBe(sequence.length);
  });

  it("starts with six seconds of input time and adds one per round", () => {
    for (const round of [1, 2, 3, 10, 20]) {
      const length = LIGHT_SEQUENCE_START_LENGTH + round - 1;
      expect(lightSequenceResponseMs(length)).toBe((5 + round) * 1000);
    }
  });

  it("evaluates the current pad and counts a round only on the last correct pad", () => {
    const sequence = [3, 3, 1] as const;

    expect(judgeLightSequenceInput(sequence, 0, 3)).toBe("correct");
    expect(judgeLightSequenceInput(sequence, 1, 1)).toBe("wrong");
    expect(judgeLightSequenceInput(sequence, 0, 3)).toBe("correct");
    expect(judgeLightSequenceInput(sequence, 1, 3)).toBe("correct");
    expect(judgeLightSequenceInput(sequence, 2, 1)).toBe("complete");
    expect(judgeLightSequenceInput(sequence, -1, 1)).toBe("wrong");
    expect(judgeLightSequenceInput(sequence, 3, 1)).toBe("wrong");
  });

  it("awards 100 points per completed round without limiting later rounds", () => {
    expect(lightSequenceScore(0)).toBe(0);
    expect(lightSequenceScore(1)).toBe(100);
    expect(lightSequenceScore(6)).toBe(600);
    expect(lightSequenceScore(30)).toBe(3000);
    for (const count of [-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(lightSequenceScore(count)).toBe(0);
    }
  });
});
