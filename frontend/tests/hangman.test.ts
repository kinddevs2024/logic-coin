import { describe, expect, it } from 'vitest';
import { challengeCoins, guessLetter, letters, newRound, nextHint, roundStatus, wordCoins } from '../src/games/hangman/logic';
import { words, keyboards } from '../src/games/hangman/content';
import { gameCoinReward } from '../src/games/rewards';
const solve = (word: string, mistakes = 0) => { let round = newRound({ word, clue: 'Test' }); for (const letter of 'XYZQJV'.slice(0, mistakes)) round = guessLetter(round, letter); for (const letter of letters(word)) round = guessLetter(round, letter); return round; };
describe('three word Hangman challenge', () => {
  it('awards exactly 333 + 333 + 334 for three perfect words, with a hard cap', () => {
    const rounds = ['BOOK', 'HERA', 'TIGER'].map(word => solve(word));
    expect(rounds.map(wordCoins)).toEqual([333, 333, 334]);
    expect(challengeCoins(rounds)).toBe(1000);
    expect(challengeCoins([...rounds, ...rounds])).toBe(1000);
    expect(gameCoinReward(50000, true, 'hangman')).toBe(1000);
  });
  it('deducts fifty coins per wrong letter, only once, and never scores an unfinished word', () => {
    expect(wordCoins(solve('BOOK', 1), 0)).toBe(283);
    expect(wordCoins(solve('BOOK', 2), 0)).toBe(233);
    let round = newRound({ word: 'BOOK', clue: 'School' });
    round = guessLetter(round, 'X'); expect(guessLetter(round, 'X')).toBe(round);
    expect(wordCoins(round, 0)).toBe(0);
  });
  it('reveals repeated letters together and uses one hint for one letter', () => {
    let round = newRound({ word: 'BOOK', clue: 'School' });
    round = guessLetter(round, 'O', true);
    expect(round.hinted).toEqual(['O']); expect(round.mistakes).toBe(0);
    expect(nextHint(round)).toBe('B');
    expect(guessLetter(round, 'O', true)).toBe(round);
    expect(guessLetter(round, 'X', true)).toBe(round);
  });
  it('ends at seven mistakes and freezes the result', () => {
    let round = newRound({ word: 'BOOK', clue: 'School' });
    for (const letter of 'XYZQJVA') round = guessLetter(round, letter);
    expect(roundStatus(round)).toBe('lost'); expect(wordCoins(round, 0)).toBe(0);
    expect(guessLetter(round, 'B')).toBe(round);
  });
  it('has solvable words on every localized keyboard, including Uzbek apostrophes', () => {
    for (const lang of ['ru', 'en', 'uz'] as const) for (const word of words[lang]) {
      expect(letters(word.word).every(char => keyboards[lang].join('').includes(char))).toBe(true);
      let round = newRound(word); for (const char of letters(word.word)) round = guessLetter(round, char);
      expect(roundStatus(round)).toBe('won');
    }
  });
});

it('spreads completed rewards from 100 to 1000 and grants no minimum before completion', () => {
  for (const [mistakes, expected] of [[0,1000],[1,850],[2,700],[3,550],[4,400],[5,250],[6,100]]) {
    expect(challengeCoins(['BOOK','HERA','TIGER'].map(word => solve(word, mistakes)))).toBe(expected);
  }
  let lost = newRound({word:'BOOK',clue:'Test'});
  for (const letter of 'XYZQJVA') lost = guessLetter(lost,letter);
  expect(challengeCoins([lost,lost,lost])).toBe(100);
  expect(challengeCoins([lost,lost,newRound({word:'BOOK',clue:'Test'})])).toBe(0);
});
