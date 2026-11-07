// Native playback uses a neutral progress track when decoded PCM is unavailable.
export function useVoiceWaveform(_url: string): number[] {
  return Array(36).fill(0.18);
}
