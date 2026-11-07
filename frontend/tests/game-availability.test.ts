import { expect, it, vi } from 'vitest';
vi.mock('expo-application', () => ({ nativeBuildVersion: '11' }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
import { isGameVisible, supportsHangman } from '../src/constants/game-availability';

it('keeps Hangman hidden on web and old APKs, and available in APK 12', () => {
  for (let code = 1; code <= 11; code++) expect(supportsHangman('android', String(code))).toBe(false);
  expect(supportsHangman('web', '12')).toBe(false);
  expect(supportsHangman('android', null)).toBe(false);
  expect(supportsHangman('android', '12')).toBe(true);
  expect(supportsHangman('android', '13')).toBe(true);
  expect(isGameVisible('hangman')).toBe(false);
  expect(isGameVisible('2048')).toBe(true);
});
