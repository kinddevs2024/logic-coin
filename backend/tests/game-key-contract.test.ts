import { describe, expect, it } from "vitest";
import {
  canonicalGameKey,
  LEGACY_GAME_KEY_ALIASES
} from "../src/lib/game-key.js";
import { DEFAULT_GAMES } from "../src/services/game-seed.service.js";

describe("canonical game catalog keys", () => {
  it("seeds only the supported game ids and no retired or legacy duplicates", () => {
    const keys = DEFAULT_GAMES.map((game) => game.key);
    expect(keys).toHaveLength(13);
    expect(new Set(keys).size).toBe(13);
    expect(keys).not.toContain("gold-rush-2048");
    expect(keys).toEqual(expect.arrayContaining(["2048", "tsvet", "udar", "fact", "shadow"]));
    expect(keys).not.toEqual(
      expect.arrayContaining(Object.keys(LEGACY_GAME_KEY_ALIASES))
    );
  });

  it("maps every shipped backend legacy alias to its frontend canonical key", () => {
    expect(canonicalGameKey("color-focus")).toBe("tsvet");
    expect(canonicalGameKey("reflex-hit")).toBe("udar");
    expect(canonicalGameKey("shadow-match")).toBe("shadow");
    expect(canonicalGameKey("  Tsvet  ")).toBe("tsvet");
  });
});
