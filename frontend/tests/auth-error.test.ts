import { afterEach, expect, it, vi } from "vitest";
import { authErrorCopy, checkAuthConnection, isConnectionError } from "../src/lib/auth-error";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("recognizes native Google and API network failures without treating credentials as offline", () => {
  for (const code of [7, "7", "NETWORK_ERROR", "network_unavailable", "connection_unavailable"]) expect(isConnectionError({ code })).toBe(true);
  expect(isConnectionError(new TypeError("Failed to fetch"))).toBe(true);
  expect(isConnectionError({ code: "invalid_credentials", message: "Wrong password" })).toBe(false);
  expect(isConnectionError(null)).toBe(false);
});
it("checks only the public health endpoint and permits online sign-in", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
  await checkAuthConnection("https://example.com/api/v1");
  expect(fetch).toHaveBeenCalledWith("https://example.com/api/v1/health", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
});
it("converts connection failure to a friendly connection code", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));
  await expect(checkAuthConnection("https://example.com/api/v1")).rejects.toMatchObject({ code: "connection_unavailable" });
});
it("does not label a server failure as no internet", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  try { await checkAuthConnection("https://example.com/api/v1"); throw Error("Expected rejection"); }
  catch (error) { expect(error).toMatchObject({ code: "service_unavailable" }); expect(isConnectionError(error)).toBe(false); }
});
it("stops waiting when the network stalls", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("Aborted"))))));
  const assertion = expect(checkAuthConnection("https://example.com/api/v1")).rejects.toMatchObject({ code: "connection_unavailable" });
  await vi.advanceTimersByTimeAsync(6000); await assertion;
});
it("supplies a short explanation and actions in all three languages", () => {
  for (const c of Object.values(authErrorCopy)) for (const value of Object.values(c)) expect(value.length).toBeGreaterThan(0);
  expect(Object.keys(authErrorCopy).sort()).toEqual(["en", "ru", "uz"]);
});
