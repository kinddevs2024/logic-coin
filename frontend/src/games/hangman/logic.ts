export type Word = { word: string; clue: string };
export type Round = { word: Word; guessed: string[]; hinted: string[]; mistakes: number };
export const WORD_COINS = [333, 333, 334] as const;
export const MAX_MISTAKES = 7;
export const MISTAKE_COST = 50;
export const MIN_CHALLENGE_COINS = 100;
export function letters(word: string) { return Array.from(word.toLocaleUpperCase()).filter(char => /[A-ZА-ЯЁ]/u.test(char)); }
export function roundStatus(round: Round): 'playing' | 'won' | 'lost' {
  if (letters(round.word.word).every(char => round.guessed.includes(char))) return 'won';
  return round.mistakes >= MAX_MISTAKES ? 'lost' : 'playing';
}
export function guessLetter(round: Round, letter: string, hint = false): Round {
  if (roundStatus(round) !== 'playing' || round.guessed.includes(letter) || letters(letter).length !== 1) return round;
  const correct = letters(round.word.word).includes(letter);
  if (hint && !correct) return round;
  return { ...round, guessed: [...round.guessed, letter], hinted: hint ? [...round.hinted, letter] : round.hinted, mistakes: round.mistakes + (correct ? 0 : 1) };
}
export function wordCoins(round: Round, index: number) {
  return roundStatus(round) === 'won' ? Math.max(0, WORD_COINS[index % 3]! - round.mistakes * MISTAKE_COST) : 0;
}
export function challengeCoins(rounds: Round[]) {
  const counted = rounds.slice(0, 3);
  const completed = counted.length === 3 && counted.every(round => roundStatus(round) !== 'playing');
  const earned = counted.reduce((sum, round, index) => sum + wordCoins(round, index), 0);
  return Math.min(1000, Math.max(completed ? MIN_CHALLENGE_COINS : 0, earned));
}
export function newRound(word: Word): Round { return { word, guessed: [], hinted: [], mistakes: 0 }; }
export function nextHint(round: Round) { return letters(round.word.word).find(char => !round.guessed.includes(char)); }
