import { decode, encode } from "fast-png";
import { fromByteArray, toByteArray } from "base64-js";
import sources from "./home-gift-pixels.json";
import { recolorGiftPixels } from "./gift-colors";

const decoded: Partial<Record<"open" | "closed", ReturnType<typeof decode>>> = {};
const cache = new Map<string, string>();
export function themedGiftSource(state: "open" | "closed", colors: [string, string]) {
  const key = [state, ...colors].join(":");
  const cached = cache.get(key);
  if (cached) return { uri: cached };
  const image = decoded[state] ??= decode(toByteArray(sources[state]));
  if (image.channels !== 4 || image.depth !== 8) throw new Error("Gift artwork must be RGBA8");
  const data = recolorGiftPixels(new Uint8Array(image.data), colors);
  const uri = "data:image/png;base64," + fromByteArray(encode({ width: image.width, height: image.height, data, channels: 4, depth: 8 }));
  // Bound memory when users try many custom photo palettes.
  if (cache.size >= 12) cache.delete(cache.keys().next().value!);
  cache.set(key, uri);
  return { uri };
}
