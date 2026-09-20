import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saved: new Map<string, string>(),
  initialUrl: null as string | null,
  state: { authMode: null as string | null },
  linkListeners: [] as ((event: { url: string }) => void)[],
  stateListeners: [] as ((state: { authMode: string | null }, previous: { authMode: string | null }) => void)[],
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => mocks.saved.get(key) ?? null,
  setItem: async (key: string, value: string) => { mocks.saved.set(key, value); },
} }));
vi.mock("expo-linking", () => ({
  getInitialURL: async () => mocks.initialUrl,
  addEventListener: (_: string, callback: (event: { url: string }) => void) => { mocks.linkListeners.push(callback); },
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/store/app-store", () => ({ useAppStore: {
  getState: () => mocks.state,
  subscribe: (callback: typeof mocks.stateListeners[number]) => { mocks.stateListeners.push(callback); },
} }));
beforeEach(() => {
  vi.resetModules();
  mocks.saved.clear();
  mocks.initialUrl = null;
  mocks.state = { authMode: null };
  mocks.linkListeners.length = 0;
  mocks.stateListeners.length = 0;
});
it("passes a warm browser-to-APK invitation through a Telegram return", async () => {
  const api = await import("../src/lib/referral-attribution");
  expect(await api.registrationReferralCode()).toBeUndefined();
  mocks.linkListeners[0]({ url: "logiccoin://invite/LCINVITER" });
  expect(await api.registrationReferralCode()).toBe("LCINVITER");
  mocks.linkListeners[0]({ url: "logiccoin://login?telegram_token=example" });
  expect(await api.registrationReferralCode()).toBe("LCINVITER");
});
it("clears attribution only after successful auth, then accepts a fresh invite", async () => {
  mocks.initialUrl = "https://logic-coin.online/invite/LCFIRST";
  const api = await import("../src/lib/referral-attribution");
  expect(await api.registrationReferralCode()).toBe("LCFIRST");
  const previous = mocks.state;
  mocks.state = { authMode: "authenticated" };
  mocks.stateListeners[0](mocks.state, previous);
  expect(await api.registrationReferralCode()).toBeUndefined();
  await api.captureRegistrationReferral("/invite/LCOTHER");
  expect(await api.registrationReferralCode()).toBeUndefined();
  mocks.state = { authMode: null };
  await api.captureRegistrationReferral("/invite/LCNEW");
  expect(await api.registrationReferralCode()).toBe("LCNEW");
});
