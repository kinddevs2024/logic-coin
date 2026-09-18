import { describe, expect, it } from "vitest";
import { createFirstVisitTracker, referralFromUrl } from "../src/lib/first-visit";

function memoryStorage() {
  let raw: string | null = null;
  return { getItem: async () => raw, setItem: async (_key: string, value: string) => { raw = value; } };
}
describe("first visit referral attribution", () => {
  it("keeps referral through navigation, reload, and a second invitation", async () => {
    const storage = memoryStorage();
    const track = createFirstVisitTracker(storage);
    expect((await track("https://logic-coin.online/invite/logic-ab12")).referralCode).toBe("LOGIC-AB12");
    expect((await track("/login")).referralCode).toBe("LOGIC-AB12");
    expect((await createFirstVisitTracker(storage)("/invite/OTHER")).referralCode).toBe("LOGIC-AB12");
  });
  it("does not replace a first organic visit with a later invite", async () => {
    const storage = memoryStorage();
    await createFirstVisitTracker(storage)("/");
    expect((await createFirstVisitTracker(storage)("/invite/OTHER")).referralCode).toBeNull();
  });
  it("serializes overlapping startup calls", async () => {
    const track = createFirstVisitTracker(memoryStorage());
    const [first, second] = await Promise.all([track("/invite/FIRST"), track("/")]);
    expect(first).toEqual(second);
    expect(first.referralCode).toBe("FIRST");
  });
  it("recognizes login query and native deep link", () => {
    expect(referralFromUrl("/login?ref=logic-1234")).toBe("LOGIC-1234");
    expect(referralFromUrl("logiccoin://invite/LOGIC-1234")).toBe("LOGIC-1234");
  });
  it("rejects malformed codes and remembers organic source", async () => {
    for (const path of ["/invite/a", "/invite/%ZZ", "/invite/%3Cscript%3E", "/invite/", "/games"]) expect(referralFromUrl(path)).toBeNull();
    const track = createFirstVisitTracker(memoryStorage());
    await track("/invite/%ZZ");
    expect((await track("/invite/VALID")).referralCode).toBeNull();
  });
  it("works in memory if persistent storage is blocked", async () => {
    const track = createFirstVisitTracker({ getItem: async () => { throw Error(); }, setItem: async () => { throw Error(); } });
    expect((await track("/invite/FIRST")).referralCode).toBe("FIRST");
    expect((await track("/")).referralCode).toBe("FIRST");
  });
});
