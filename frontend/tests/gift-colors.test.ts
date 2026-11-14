import { describe, expect, it } from "vitest";
import { decode } from "fast-png";
import { toByteArray } from "base64-js";
import { unzlibSync } from "fflate";
import { giftPalette, recolorGiftPixels, rgbToHsv } from "../src/lib/gift-colors";
import { themedGiftSource } from "../src/lib/themed-gift-image";
import source from "../src/lib/home-gift-pixels.json";

describe("theme-aware gift artwork", () => {
  it("changes green and gold independently while preserving highlights, value and alpha", () => {
    const original = new Uint8Array([0, 200, 130, 240, 200, 130, 0, 128, 250, 250, 250, 255, 80, 90, 100, 0]);
    const out = recolorGiftPixels(original, ["#2484ce", "#e58ab5"]);
    expect(rgbToHsv(...Array.from(out.slice(0, 3)) as [number,number,number])[0]).toBeGreaterThan(190);
    expect(rgbToHsv(...Array.from(out.slice(4, 7)) as [number,number,number])[0]).toBeGreaterThan(300);
    expect(out.slice(8)).toEqual(original.slice(8));
    expect(out[3]).toBe(240); expect(out[7]).toBe(128);
    expect(Math.max(...out.slice(0, 3))).toBe(200);
    expect(original[0]).toBe(0);
  });
  it("renders neutral photo accents without green or gold leftovers", () => {
    const out = recolorGiftPixels(new Uint8Array([0, 200, 130, 255]), ["#777777", "#bbbbbb"]);
    expect(out[0]).toBe(out[1]); expect(out[1]).toBe(out[2]);
    expect(giftPalette("#e58ab5")).not.toEqual(giftPalette("#2484ce"));
  });
  it.each(["open", "closed"] as const)("produces a valid %s PNG with every alpha pixel retained", state => {
    const original = { ...source[state], data: unzlibSync(toByteArray(source[state].rgba)) };
    const result = themedGiftSource(state, giftPalette("#e58ab5"));
    const image = decode(toByteArray(result.uri.split(",")[1]));
    expect([image.width, image.height]).toEqual([original.width, original.height]);
    expect(image.data.filter((_, i) => i % 4 === 3)).toEqual(original.data.filter((_, i) => i % 4 === 3));
    expect(themedGiftSource(state, giftPalette("#e58ab5"))).toEqual(result);
  });
});
