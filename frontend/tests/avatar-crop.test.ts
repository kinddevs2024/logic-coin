import { describe, expect, it } from "vitest";
import { avatarCropPixels, initialAvatarCrop } from "../src/lib/avatar-crop";

describe("avatar crop exports the selected region", () => {
  it("keeps an off-center crop instead of recentering it", () => {
    expect(avatarCropPixels({ x: 5, y: 10, width: 20, height: 40 }, 1000, 500)).toEqual({ x: 50, y: 50, width: 200, height: 200 });
  });
  it("keeps a right-bottom selection", () => {
    expect(avatarCropPixels({ x: 75, y: 75, width: 25, height: 25 }, 800, 800)).toEqual({ x: 600, y: 600, width: 200, height: 200 });
  });
  it.each([[1600, 900], [900, 1600], [640, 640]])("initial selection is square on %ix%i photos", (width, height) => {
    const rect = avatarCropPixels(initialAvatarCrop(width, height), width, height);
    expect(rect.width).toBe(rect.height);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height);
  });
  it("clamps rounding at image edges", () => {
    expect(avatarCropPixels({ x: 80, y: 80, width: 21, height: 21 }, 999, 999)).toEqual({ x: 799, y: 799, width: 200, height: 200 });
  });
  it("rejects invalid images and empty selections", () => {
    expect(() => avatarCropPixels({ x: 0, y: 0, width: 0, height: 0 }, 800, 800)).toThrow();
    expect(() => avatarCropPixels({ x: 0, y: 0, width: 100, height: 100 }, 0, 0)).toThrow();
  });
});
