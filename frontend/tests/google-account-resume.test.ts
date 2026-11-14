import { expect, it, vi } from "vitest";
import { resumeGoogleAccount } from "../src/lib/google-account-resume";
function sdk() { return { hasPlayServices: vi.fn().mockResolvedValue(true), signOut: vi.fn().mockResolvedValue(null), signIn: vi.fn().mockResolvedValue({ type: "cancelled" }) }; }
it("opens the account picker once and preserves a dismissal", async () => {
  const api = sdk(); expect(await resumeGoogleAccount(api)).toEqual({ type: "cancelled" });
  expect(api.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: false });
  expect(api.signIn).toHaveBeenCalledOnce();
});
it("clears the app's old selection before showing Google's account choice", async () => {
  const api = sdk(); await resumeGoogleAccount(api);
  expect(api.signOut.mock.invocationCallOrder[0]).toBeLessThan(api.signIn.mock.invocationCallOrder[0]!);
});
it("does not open sign-in when Play Services are unavailable", async () => {
  const api = sdk(); api.hasPlayServices.mockRejectedValue(new Error("unavailable"));
  await expect(resumeGoogleAccount(api)).rejects.toThrow("unavailable");
  expect(api.signIn).not.toHaveBeenCalled();
});
