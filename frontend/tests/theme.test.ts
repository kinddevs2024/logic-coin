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

describe("green brand themes", () => {
  it.each(["light", "sky"] as const)("preserves game colors in %s", (mode) => {
    for (const { color } of GAME_CATALOG) {
      expect(readableAccent(color, mode)).toBe(color);
      expect(accentForeground(color, mode)).toBe("#FFFFFF");
    }
    expect(themes[mode].onPrimary).toBe("#FFFFFF");
  });

  it.each(["light", "sky"] as const)("uses the restored green and gold brand in %s", mode => {
    expect(themes[mode]).toMatchObject({ background: "#EDF5E9", primary: "#007A57", primaryDark: "#006345", orbOne: "#78DDB0", orbTwo: "#F0D48C" });
    for (const surface of [themes[mode].surface, themes[mode].background]) {
      expect(contrastRatio(String(themes[mode].text), String(surface))).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(String(themes[mode].textMuted), String(surface))).toBeGreaterThanOrEqual(4.5);
    }
  });
});