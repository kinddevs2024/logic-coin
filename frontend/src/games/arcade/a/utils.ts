import { gameCoinReward } from "../../rewards";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function nowMs() {
  return Date.now();
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomIntExcluding(min: number, max: number, excluded?: number) {
  if (max <= min || excluded === undefined || excluded < min || excluded > max) {
    return randomInt(min, max);
  }
  const candidate = randomInt(min, max - 1);
  return candidate >= excluded ? candidate + 1 : candidate;
}

export function shuffle<T>(values: readonly T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

export function shuffleAvoidingFirst<T>(values: readonly T[], excluded?: T): T[] {
  const shuffled = shuffle(values);
  if (excluded === undefined || shuffled.length < 2 || shuffled[0] !== excluded) return shuffled;
  const replacement = shuffled.findIndex((value) => value !== excluded);
  if (replacement > 0) [shuffled[0], shuffled[replacement]] = [shuffled[replacement]!, shuffled[0]!];
  return shuffled;
}

export function formatClock(milliseconds: number, showCentiseconds = false) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  if (!showCentiseconds) return `${minutes}:${seconds}`;
  const centiseconds = String(Math.floor((milliseconds % 1000) / 10)).padStart(2, "0");
  return minutes > 0 ? `${minutes}:${seconds}.${centiseconds}` : `${seconds}.${centiseconds}`;
}

export function suggestedCoins(score: number, won = true) {
  return gameCoinReward(score, won);
}
