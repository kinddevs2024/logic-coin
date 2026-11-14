import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ language: "ru" as "ru" | "en" | "uz", platform: "android", share: vi.fn(), copy: vi.fn() }));
vi.mock("@/store/app-store", () => ({ useAppStore: { getState: () => ({ language: fixture.language }) } }));
vi.mock("@/components/localized-native", () => ({ copyText: (value: string) => value, Alert: { alert: vi.fn() }, Share: { share: fixture.share } }));
vi.mock("expo-clipboard", () => ({ setStringAsync: fixture.copy }));
vi.mock("react-native", () => ({ Platform: { get OS() { return fixture.platform; } } }));
import { shareLink } from "../src/lib/share-link";
import { referralInvitationMessage } from "../src/lib/referral-invitation";
beforeEach(() => { vi.clearAllMocks(); fixture.platform = "android"; });
afterEach(() => vi.unstubAllGlobals());
it.each(["uz", "en", "ru"] as const)("shares the %s invitation and preserves referral attribution", async language => {
  fixture.language = language;
  await shareLink("Logic Coin", referralInvitationMessage(language), "https://logic-coin.online/invite/LOGIC-TEST?preview=3");
  const message = fixture.share.mock.calls[0]?.[0].message as string;
  expect(message.startsWith(referralInvitationMessage(language))).toBe(true);
  const url = new URL(message.split("\n")[1]!);
  expect(url.pathname).toBe("/invite/LOGIC-TEST"); expect(url.searchParams.get("lang")).toBe(language);
  expect(url.searchParams.get("preview")).toBe("3");
  if (language !== "ru") expect(message).not.toMatch(/[А-Яа-я]/);
});
it("shares English through the browser and uses the current language on the next share", async () => {
  fixture.platform = "web"; const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { share }); fixture.language = "en";
  await shareLink("Logic Coin", referralInvitationMessage("en"), "https://logic-coin.online/invite/TEST-CODE");
  expect(share.mock.calls[0]?.[0].text).toBe(referralInvitationMessage("en"));
  fixture.language = "uz";
  await shareLink("Logic Coin", referralInvitationMessage("uz"), "https://logic-coin.online/invite/TEST-CODE");
  expect(new URL(share.mock.calls[1]?.[0].url).searchParams.get("lang")).toBe("uz");
});
it("copies Uzbek invitation text as well as the link when browser sharing is unavailable", async () => {
  fixture.platform = "web"; fixture.language = "uz";
  vi.stubGlobal("navigator", {}); vi.stubGlobal("window", { alert: vi.fn() });
  await shareLink("Logic Coin", referralInvitationMessage("uz"), "https://logic-coin.online/invite/TEST-CODE");
  expect(fixture.copy.mock.calls[0]?.[0]).toContain(referralInvitationMessage("uz") + "\n");
  expect(fixture.copy.mock.calls[0]?.[0]).toContain("lang=uz");
});
