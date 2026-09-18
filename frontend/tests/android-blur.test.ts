import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { View } from "react-native";
import { describe, expect, it, vi } from "vitest";

import {
  GlassBlurTargetContext,
  ScreenBlurTargetContext,
  useModalBlurTarget,
} from "../src/components/glass-blur-target";
import { createSoftGlow } from "../src/lib/soft-glow";

const platform = vi.hoisted(() => ({ OS: "android" }));
vi.mock("react-native", () => ({ Platform: platform }));

describe("Android ambient glow", () => {
  it.each([[270, 46], [320, 46], [190, 46], [440, 46], [520, 46], [310, 44], [360, 36]])(
    "softens a %ipx circle with a %ipx edge without a clipped boundary",
    (diameter, blurRadius) => {
      const glow = createSoftGlow(diameter, blurRadius);
      expect(glow.padding).toBe(blurRadius * 3);
      expect(glow.size).toBe(diameter + blurRadius * 6);
      expect(glow.stops[0].opacity).toBeGreaterThan(0.9);
      expect(glow.stops.at(-1)).toEqual({ offset: 1, opacity: 0 });
      for (let i = 1; i < glow.stops.length; i += 1) {
        expect(glow.stops[i].offset).toBeGreaterThan(glow.stops[i - 1].offset);
        expect(glow.stops[i].opacity).toBeLessThan(glow.stops[i - 1].opacity);
        expect(glow.stops[i].opacity).toBeGreaterThanOrEqual(0);
      }
      const originalEdge = diameter / glow.size;
      const edge = glow.stops.find((stop) => stop.offset >= originalEdge)!;
      expect(edge.opacity).toBeGreaterThan(0.3);
      expect(edge.opacity).toBeLessThanOrEqual(0.5);
    },
  );
});

describe("modal blur source", () => {
  const background = { current: { id: "ambient-only" } } as unknown as RefObject<View | null>;
  const screen = { current: { id: "screen-with-cards" } } as unknown as RefObject<View | null>;

  function readTarget(os: string, fullScreen: RefObject<View | null> | null) {
    platform.OS = os;
    let result: RefObject<View | null> | null = null;
    function Probe() {
      result = useModalBlurTarget();
      return null;
    }
    renderToStaticMarkup(createElement(
      ScreenBlurTargetContext.Provider, { value: fullScreen },
      createElement(GlassBlurTargetContext.Provider, { value: background }, createElement(Probe)),
    ));
    return result;
  }

  it("captures all screen content on Android, not just AppFrame's orbs", () => {
    expect(readTarget("android", screen)).toBe(screen);
  });

  it("does not cover the screen with an ambient-only snapshot before capture is ready", () => {
    expect(readTarget("android", null)).toBeNull();
  });

  it.each(["web", "ios"])("preserves the existing %s rendering source", (os) => {
    expect(readTarget(os, screen)).toBe(background);
  });
});
