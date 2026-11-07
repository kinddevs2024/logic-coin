import { describe, it, expect } from "vitest";
import { canPostChat, normalizeUsername } from "../src/lib/chat-policy.js";
describe("chat permissions", () => {
  it("reserves the official news feed for site administrators", () => {
    expect(
      canPostChat({
        kind: "channel",
        systemKey: "news",
        siteAdmin: false,
        memberRole: "owner",
      }),
    ).toBe(false);
    expect(
      canPostChat({ kind: "channel", systemKey: "news", siteAdmin: true }),
    ).toBe(true);
  });
  it("allows channel owners and appointed administrators but not subscribers", () => {
    expect(
      canPostChat({ kind: "channel", siteAdmin: false, memberRole: "member" }),
    ).toBe(false);
    expect(
      canPostChat({ kind: "channel", siteAdmin: false, memberRole: "admin" }),
    ).toBe(true);
    expect(
      canPostChat({ kind: "channel", siteAdmin: false, memberRole: "owner" }),
    ).toBe(true);
  });
  it("lets community and private chat members write", () => {
    for (const kind of ["group", "direct", "support"])
      expect(
        canPostChat({ kind, siteAdmin: false, memberRole: "member" }),
      ).toBe(true);
  });
});
describe("optional unique usernames", () => {
  it("accepts the reported public channel handle", () => {
    expect(normalizeUsername("Toshkentlik_01")).toBe("toshkentlik_01");
  });
  it("normalizes case and removes @", () =>
    expect(normalizeUsername(" @AbCd_12 ")).toBe("abcd_12"));
  it("rejects reserved names, markup, invalid lengths and non-Latin usernames", () => {
    for (const name of [
      "admin",
      "support",
      "abc",
      "1abcd",
      "<script>",
      "привет",
      "a".repeat(25),
    ])
      expect(normalizeUsername(name)).toBeNull();
  });
});
