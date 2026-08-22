import { gameCoinReward } from "../../rewards";

export function shuffle<T>(source: readonly T[]): T[] {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function shuffleAvoidingFirst<T>(source: readonly T[], excluded?: T): T[] {
  const shuffled = shuffle(source);
  if (excluded === undefined || shuffled.length < 2 || shuffled[0] !== excluded) return shuffled;
  const replacement = shuffled.findIndex((value) => value !== excluded);
  if (replacement > 0) [shuffled[0], shuffled[replacement]] = [shuffled[replacement]!, shuffled[0]!];
  return shuffled;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomIntExcluding(min: number, max: number, excluded?: number): number {
  if (max <= min || excluded === undefined || excluded < min || excluded > max) {
    return randomInt(min, max);
  }
  const candidate = randomInt(min, max - 1);
  return candidate >= excluded ? candidate + 1 : candidate;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function rewardCoins(score: number, won = true): number {
  return gameCoinReward(score, won);
}

export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}с`;
}

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
