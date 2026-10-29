import { requireOptionalNativeModule } from 'expo-modules-core';
import { useMemo } from 'react';
import type { AudioSource, AudioPlayer } from 'expo-audio';

type Player = Pick<AudioPlayer, 'volume' | 'pause' | 'play' | 'seekTo'>;
function useSilentPlayer(_source?: AudioSource): Player {
  return useMemo(() => ({ volume: 0, pause() {}, play() {}, async seekTo() {} }), []);
}
// Old released APKs do not include ExpoAudio. Never evaluate that package's
// native entry point unless the installed binary actually contains the module.
const useInstalledPlayer: (source?: AudioSource) => Player = requireOptionalNativeModule('ExpoAudio')
  ? require('expo-audio').useAudioPlayer
  : useSilentPlayer;
export function useCompatibleAudioPlayer(source?: AudioSource): Player {
  return useInstalledPlayer(source);
}
