import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null }));

describe('legacy APK compatibility', () => {
  it('loads the game audio adapter when the installed APK has no ExpoAudio module', async () => {
    // An unconditional ExpoAudio import cannot initialize under this Node test,
    // just as it cannot initialize in a binary without that native module.
    const adapter = await import('../src/games/hangman/audio-player.native');
    expect(typeof adapter.useCompatibleAudioPlayer).toBe('function');
  });
});
