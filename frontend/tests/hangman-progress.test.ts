import { expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async () => null, setItem: async () => {}, removeItem: async () => {},
} }));

it('keeps the initial Hangman snapshot stable before saved progress exists', async () => {
  const { gameProgressFor } = await import('../src/games/progress-store');
  const first = gameProgressFor({}, 'hangman');
  expect(gameProgressFor({}, 'hangman')).toBe(first);
});
