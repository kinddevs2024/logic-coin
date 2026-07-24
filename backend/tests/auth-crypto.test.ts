import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  generatePkceVerifier,
  generateRegistrationToken,
  hashOAuthBinding,
  hashOpaqueToken,
  opaqueTokenMatches,
  pkceS256Challenge
} from "../src/lib/crypto.js";

describe("registration session tokens", () => {
  it("matches only the one-time token whose SHA-256 hash is stored", () => {
    const registrationToken = generateRegistrationToken();
    const storedHash = hashOpaqueToken(registrationToken);

    expect(registrationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(opaqueTokenMatches(registrationToken, storedHash)).toBe(true);
    expect(opaqueTokenMatches(generateRegistrationToken(), storedHash)).toBe(false);
  });
});

describe("Yandex OAuth PKCE and browser binding", () => {
  it("creates an RFC 7636-compatible S256 challenge", () => {
    const verifier = generatePkceVerifier();
    const expectedChallenge = createHash("sha256").update(verifier).digest("base64url");

    expect(verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(pkceS256Challenge(verifier)).toBe(expectedChallenge);
  });

  it("binds a challenge to the device when available and otherwise to the user agent", () => {
    const deviceBound = hashOAuthBinding("yandex", {
      deviceId: "device-123",
      userAgent: "browser-a"
    });
    const sameDeviceDifferentAgent = hashOAuthBinding("yandex", {
      deviceId: "device-123",
      userAgent: "browser-b"
    });
    const agentBound = hashOAuthBinding("yandex", { userAgent: "browser-a" });

    expect(deviceBound).toBe(sameDeviceDifferentAgent);
    expect(agentBound).not.toBe(deviceBound);
    expect(hashOAuthBinding("yandex", {})).toBeNull();
  });
});
