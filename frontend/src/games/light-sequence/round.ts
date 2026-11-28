import type { RandomSource } from "../random";

const PADS = [0, 1, 2, 3] as const;
const POINTS_PER_ROUND = 100;

export type LightSequencePad = (typeof PADS)[number];
export const LIGHT_SEQUENCE_PAD_COUNT = PADS.length;
export const LIGHT_SEQUENCE_START_LENGTH = 2;
export const LIGHT_SEQUENCE_CHALLENGE_ERRORS = 3;

export function createLightSequence(
  length = LIGHT_SEQUENCE_START_LENGTH,
  random: RandomSource = Math.random,
): LightSequencePad[] {
  if (!Number.isSafeInteger(length) || length < LIGHT_SEQUENCE_START_LENGTH) {
    throw new RangeError("Invalid light sequence length");
  }

  const sequence = new Array<LightSequencePad>(length);
  for (let index = 0; index < length; index += 1) {
    const sample = random();
    if (!(sample >= 0 && sample < 1)) throw new RangeError("Random value must be in [0, 1)");

    const lastPad = sequence[index - 1];
    const repeatedPad = lastPad === sequence[index - 2] ? lastPad : undefined;
    if (repeatedPad === undefined) {
      sequence[index] = PADS[Math.floor(sample * LIGHT_SEQUENCE_PAD_COUNT)]!;
    } else {
      // Sample the eligible pads uniformly by skipping the one that appeared twice.
      const choice = Math.floor(sample * (LIGHT_SEQUENCE_PAD_COUNT - 1));
      sequence[index] = PADS[choice < repeatedPad ? choice : choice + 1]!;
    }
  }
  return sequence;
}

export function lightSequenceResponseMs(sequenceLength: number): number {
  return (4 + sequenceLength) * 1000;
}

export function judgeLightSequenceInput(
  sequence: readonly LightSequencePad[],
  position: number,
  pad: number,
): "correct" | "complete" | "wrong" {
  if (sequence[position] !== pad) return "wrong";
  return position === sequence.length - 1 ? "complete" : "correct";
}

export function lightSequenceScore(completedRounds: number): number {
  const score = completedRounds * POINTS_PER_ROUND;
  return Number.isSafeInteger(completedRounds) && completedRounds > 0 && Number.isSafeInteger(score)
    ? score
    : 0;
}
