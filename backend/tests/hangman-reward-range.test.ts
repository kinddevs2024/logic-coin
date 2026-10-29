import { expect, it } from 'vitest';
import { challengeCoinsForScore } from '../src/services/challenge-attempt.service.js';

it('keeps completed Hangman base rewards in the 100–1000 range', () => {
  for (const [score, reward] of [[0,100],[99,100],[100,100],[550,550],[950,950],[1000,1000],[50000,1000]]) {
    expect(challengeCoinsForScore(score, 1000, 'hangman')).toBe(reward);
  }
});
