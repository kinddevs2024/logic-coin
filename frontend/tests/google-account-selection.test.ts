import { expect, it, vi } from "vitest";
import { selectGoogleAccount } from "../src/lib/google-account-selection";

it("clears the remembered account before each explicit sign-in", async () => {
  const calls: string[] = [];
  const sdk = {
    hasPlayServices: async () => { calls.push("services"); },
    signOut: async () => { calls.push("signOut"); },
    signIn: async () => { calls.push("signIn"); return { type: "success" }; },
  };
  expect(await selectGoogleAccount(sdk)).toEqual({ type: "success" });
  await selectGoogleAccount(sdk);
  expect(calls).toEqual(["services", "signOut", "signIn", "services", "signOut", "signIn"]);
});
it("does not fall back to silently signing in when clearing the selection fails", async () => {
  const sdk = { hasPlayServices: async () => true, signOut: async () => { throw Error("unavailable"); }, signIn: vi.fn() };
  await expect(selectGoogleAccount(sdk)).rejects.toThrow("unavailable");
  expect(sdk.signIn).not.toHaveBeenCalled();
});
it("preserves cancellation instead of inventing a credential", async () => {
  expect(await selectGoogleAccount({ hasPlayServices: async () => true, signOut: async () => undefined, signIn: async () => ({ type: "cancelled" }) })).toEqual({ type: "cancelled" });
});
