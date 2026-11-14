export type RandomSource = () => number;

export function shuffledIndexes(
  count: number,
  previousFirst?: number,
  random: RandomSource = Math.random,
): number[] {
  const result = Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => index);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  if (previousFirst !== undefined && result.length > 1 && result[0] === previousFirst) {
    const replacement = result.findIndex((value) => value !== previousFirst);
    [result[0], result[replacement]] = [result[replacement]!, result[0]!];
  }
  return result;
}
