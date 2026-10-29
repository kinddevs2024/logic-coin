import { Asset } from 'expo-asset';
import { useEffect, useMemo } from 'react';

export function useCompatibleAudioPlayer(source: number) {
  const player = useMemo(() => {
    const audio = typeof Audio === 'undefined' ? null : new Audio(Asset.fromModule(source).uri);
    return {
      get volume() { return audio?.volume ?? 0; },
      set volume(value: number) { if (audio) audio.volume = value; },
      pause() { audio?.pause(); },
      play() { void audio?.play().catch(() => {}); },
      async seekTo(seconds: number) { if (audio) audio.currentTime = seconds; },
    };
  }, [source]);
  useEffect(() => () => player.pause(), [player]);
  return player;
}
