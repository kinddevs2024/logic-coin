import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it, vi } from "vitest";

const mockedEnv = vi.hoisted(() => ({
  ADMIN_PASSWORD_HASH: undefined as string | undefined,
  ADMIN_JWT_SECRET: "test-admin-jwt-secret-that-is-long-enough",
  ADMIN_TOKEN_TTL: "5m",
  JWT_ISSUER: "logic-coin-test",
  JWT_AUDIENCE: "logic-coin-test-app"
}));

vi.mock("../src/config/env.js", () => ({ env: mockedEnv }));

import {
  authenticateAdminPassword,
  verifyAdminToken
} from "../src/services/admin-auth.service.js";

describe("password-only administrator authentication", () => {
  beforeAll(async () => {
    mockedEnv.ADMIN_PASSWORD_HASH = await bcrypt.hash("valid-test-password", 4);
  });

  it("compares against the bcrypt hash and issues a dedicated short-lived token", async () => {
    const result = await authenticateAdminPassword("valid-test-password");
    expect(result.tokenType).toBe("Bearer");
    expect(result.adminToken).not.toContain("valid-test-password");
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(verifyAdminToken(result.adminToken)).toMatchObject({
      sub: "password-admin",
      type: "admin"
    });
  });

  it("rejects an incorrect password without issuing a token", async () => {
    await expect(authenticateAdminPassword("wrong-test-password")).rejects.toMatchObject({
      statusCode: 401,
      code: "invalid_admin_credentials"
    });
  });
});
