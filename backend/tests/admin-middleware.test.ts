import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userModelMocks = vi.hoisted(() => ({
  findById: vi.fn()
}));
const adminTokenMocks = vi.hoisted(() => ({ verifyAdminToken: vi.fn() }));

vi.mock("../src/models/User.js", () => ({ User: userModelMocks }));
vi.mock("../src/config/env.js", () => ({
  env: { ADMIN_EMAILS: ["configured-admin@example.com"] }
}));
vi.mock("../src/services/admin-auth.service.js", () => adminTokenMocks);

import { requireAdmin, requireAdminToken } from "../src/middleware/admin.js";

function requestFor(userId = new Types.ObjectId()): Request {
  return { auth: { userId, sessionId: "test-session" } } as unknown as Request;
}

function resolveUser(user: { role: string; email: string } | null) {
  userModelMocks.findById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(user)
    })
  });
}

describe("administrator authorization", () => {
  beforeEach(() => {
    userModelMocks.findById.mockReset();
  });

  it("allows users with the persisted admin role", async () => {
    resolveUser({ role: "admin", email: "admin@example.com" });
    const next = vi.fn();

    await requireAdmin(requestFor(), {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("allows configured admin emails without mutating the user", async () => {
    resolveUser({ role: "user", email: "CONFIGURED-ADMIN@EXAMPLE.COM" });
    const next = vi.fn();

    await requireAdmin(requestFor(), {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects ordinary and missing users", async () => {
    const next = vi.fn();
    resolveUser({ role: "user", email: "player@example.com" });

    await requireAdmin(requestFor(), {} as Response, next as NextFunction);

    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ statusCode: 403, code: "admin_required" })
    );

    next.mockClear();
    resolveUser(null);
    await requireAdmin(requestFor(), {} as Response, next as NextFunction);
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ statusCode: 403, code: "admin_required" })
    );
  });
});

describe("administrator token gate", () => {
  it("requires a dedicated bearer token", () => {
    const next = vi.fn();
    const request = { header: vi.fn().mockReturnValue(undefined) } as unknown as Request;
    requireAdminToken(request, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: "admin_authentication_required" })
    );
  });

  it("attaches verified administrator identity", () => {
    adminTokenMocks.verifyAdminToken.mockReturnValue({
      sub: "password-admin",
      type: "admin",
      jti: "admin-token-id"
    });
    const next = vi.fn();
    const request = {
      header: vi.fn().mockReturnValue("Bearer admin-token")
    } as unknown as Request;
    requireAdminToken(request, {} as Response, next as NextFunction);
    expect(request.adminAuth).toEqual({ subject: "password-admin", tokenId: "admin-token-id" });
    expect(next).toHaveBeenCalledWith();
  });
});
