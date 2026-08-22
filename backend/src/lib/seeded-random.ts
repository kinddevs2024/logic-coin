export function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function pickSeededSubset<T>(items: readonly T[], count: number, seed: string): T[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("count must be a non-negative integer");
  }
  const random = mulberry32(hashSeed(seed));
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const temporary = pool[index]!;
    pool[index] = pool[swapIndex]!;
    pool[swapIndex] = temporary;
  }
  return pool.slice(0, Math.min(count, pool.length));
}
