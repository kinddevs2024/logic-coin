import { useEffect, useState } from "react";
const cache = new Map<string, number[]>();
export function useVoiceWaveform(url: string) {
  const [bars, setBars] = useState<number[]>(
    () => cache.get(url) ?? Array(36).fill(0.18),
  );
  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    if (cache.has(url)) return;
    void (async () => {
      let context: AudioContext | undefined;
      try {
        const response = await fetch(url, { signal: abort.signal });
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        if (cancelled) return;
        context = new AudioContext();
        const audio = await context.decodeAudioData(bytes);
        const pcm = audio.getChannelData(0);
        const samples = Array.from({ length: 36 }, (_, index) => {
          const start = Math.floor((index * pcm.length) / 36);
          const end = Math.floor(((index + 1) * pcm.length) / 36);
          let energy = 0;
          for (let i = start; i < end; i++) energy += pcm[i]! * pcm[i]!;
          return Math.sqrt(energy / Math.max(1, end - start));
        });
        const peak = Math.max(...samples, 0.001);
        const result = samples.map((value) => Math.max(0.12, value / peak));
        if (cache.size >= 30) cache.delete(cache.keys().next().value!);
        cache.set(url, result);
        if (!cancelled) setBars(result);
      } catch {
        /* Keep the neutral track if decoding is unavailable. */
      } finally {
        await context?.close();
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [url]);
  return cache.get(url) ?? bars;
}
