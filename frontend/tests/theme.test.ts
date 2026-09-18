import { describe, expect, it } from "vitest";

import { GAME_CATALOG } from "../src/constants/games";
import { themes } from "../src/constants/theme";
import { accentForeground, contrastRatio, readableAccent } from "../src/lib/theme-colors";

describe("dark theme contrast", () => {
  const dark = themes.dark;
  const surfaces = [dark.background, dark.backgroundStart, dark.surface, dark.surfaceRaised, dark.surfaceMuted, dark.primarySoft];

  it("uses a measurable contrast calculation", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    expect(contrastRatio("#152137", "#152137")).toBe(1);
  });

  it.each(surfaces)("keeps primary and secondary text readable on %s", (surface) => {
    expect(contrastRatio(String(dark.text), String(surface))).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(String(dark.textMuted), String(surface))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(String(dark.primary), String(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([dark.primary, dark.primaryDark, dark.success, dark.warning, dark.danger])(
    "keeps filled actions readable on %s", (background) => {
      expect(contrastRatio(String(dark.onPrimary), String(background))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(GAME_CATALOG.map(({ key, color }) => [key, color]))(
    "preserves readable labels and action text for %s", (_key, color) => {
      expect(contrastRatio(readableAccent(color, "dark"), "#253650")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(accentForeground(color, "dark"), color)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("keeps unknown API colors safe without breaking rendering", () => {
    expect(readableAccent("rebeccapurple", "dark")).toBe("rebeccapurple");
    expect(readableAccent("", "dark")).toBe("");
  });
});

describe("other themes remain unchanged", () => {
  it.each(["light", "sky"] as const)("preserves game colors in %s", (mode) => {
    for (const { color } of GAME_CATALOG) {
      expect(readableAccent(color, mode)).toBe(color);
      expect(accentForeground(color, mode)).toBe("#FFFFFF");
    }
    expect(themes[mode].onPrimary).toBe("#FFFFFF");
  });

  it("preserves the light palette", () => {
    expect(themes.light).toMatchObject({
      background: "#F5F7FA", backgroundStart: "#FFFFFF", backgroundMiddle: "#F2F6FA", backgroundEnd: "#E8EFF6",
      surface: "#FFFFFF", surfaceRaised: "#FFFFFF", surfaceMuted: "#EEF2F6", text: "#101418", textMuted: "#69737D",
      primary: "#087CFF", primaryDark: "#0064D6", primarySoft: "#E7F2FF", border: "#DEE5EC",
      success: "#12B76A", warning: "#F5A524", danger: "#F04438", shadow: "#274158", orbOne: "#7BC1FF", orbTwo: "#B9A8FF",
      tabBar: "rgba(250,252,254,0.84)", glassFill: "rgba(255,255,255,0.58)", glassFillStrong: "rgba(255,255,255,0.78)",
      glassBorder: "rgba(255,255,255,0.86)", glassHighlight: "rgba(255,255,255,0.78)", glassTint: "#F0F7FF", glassShadow: "#53697C",
    });
  });

  it("preserves the sky palette", () => {
    expect(themes.sky).toMatchObject({
      background: "#DFF3FF", backgroundStart: "#F1FBFF", backgroundMiddle: "#D7F0FF", backgroundEnd: "#B9DFFF",
      surface: "#F9FCFF", surfaceRaised: "#FFFFFF", surfaceMuted: "#DFF0FF", text: "#082449", textMuted: "#57708D",
      primary: "#006AC7", primaryDark: "#0059A8", primarySoft: "#DDF0FF", border: "#CFE5F8",
      success: "#0DA968", warning: "#E89517", danger: "#E84A5F", shadow: "#0878D8", orbOne: "#45B8FF", orbTwo: "#83E6ED",
      tabBar: "rgba(239,249,255,0.72)", glassFill: "rgba(238,249,255,0.5)", glassFillStrong: "rgba(246,252,255,0.76)",
      glassBorder: "rgba(255,255,255,0.78)", glassHighlight: "rgba(255,255,255,0.9)", glassTint: "#DDF3FF", glassShadow: "#208BCB",
    });
  });
});
