import { describe, it, expect } from "vitest";
import { MIGRATED_APP_ORIGIN, migratedAppUrl, migratedResponseUrls } from "../src/lib/server-migration";

describe("independent server URLs", () => {
  it("preserves paths, query and fragment while replacing only the two owned hosts", () => {
    expect(migratedAppUrl("https://www.logic-coin.online/api/v1/avatars/a/b.webp?v=2#x")).toBe(`${MIGRATED_APP_ORIGIN}/api/v1/avatars/a/b.webp?v=2#x`);
    for (const url of ["https://logic-coin.online.attacker.test/a", "https://external.test/a", "data:image/png;base64,AA==", "/assets/a.png"]) expect(migratedAppUrl(url)).toBe(url);
  });
  it("migrates nested URL fields without changing user text or the original object", () => {
    const input = { friends: [{ avatarUrl: "https://logic-coin.online/api/v1/avatars/a/b.webp", name: "https://logic-coin.online/keep-this-text" }], url: "https://external.test" };
    const result = migratedResponseUrls(input);
    expect(result.friends[0]?.avatarUrl).toBe(`${MIGRATED_APP_ORIGIN}/api/v1/avatars/a/b.webp`);
    expect(result.friends[0]?.name).toBe(input.friends[0]?.name);
    expect(input.friends[0]?.avatarUrl).toContain("https://logic-coin.online/");
    expect(result.url).toBe(input.url);
  });
});
