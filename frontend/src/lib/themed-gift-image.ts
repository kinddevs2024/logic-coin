import { unzlibSync } from "fflate";
import { fromByteArray, toByteArray } from "base64-js";
import sources from "./home-gift-pixels.json";
import { recolorGiftPixels } from "./gift-colors";
import { encodeGiftPng } from "./gift-png";

const decoded: Partial<Record<"open" | "closed", Uint8Array>> = {};
const cache = new Map<string, string>();
export function themedGiftSource(state: "open" | "closed", colors: [string, string]) {
  const key = [state, ...colors].join(":");
  const cached = cache.get(key);
  if (cached) return { uri: cached };
  const image = sources[state];
  const original = decoded[state] ??= unzlibSync(toByteArray(image.rgba));
  const data = recolorGiftPixels(original, colors);
  const uri = "data:image/png;base64," + fromByteArray(encodeGiftPng(image.width, image.height, data));
  // Bound memory when users try many custom photo palettes.
  if (cache.size >= 12) cache.delete(cache.keys().next().value!);
  cache.set(key, uri);
  return { uri };
}
