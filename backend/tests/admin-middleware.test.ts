import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userModelMocks = vi.hoisted(() => ({
  findById: vi.fn()
}));

vi.mock("../src/models/User.js", () => ({ User: userModelMocks }));
vi.mock("../src/config/env.js", () => ({
  env: { ADMIN_EMAILS: ["configured-admin@example.com"] }
}));
import { requireAdmin, requireReports } from "../src/middleware/admin.js";

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

  it("rejects a demoted account even when its email is configured", async () => {
    resolveUser({ role: "user", email: "CONFIGURED-ADMIN@EXAMPLE.COM" });
    const next = vi.fn();

    await requireAdmin(requestFor(), {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
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

describe("separate owner access", () => {
 it.each(["manager", "owner", "user"])("denies %s all administrative mutations", async role => {
  resolveUser({role,email:"configured-admin@example.com"});const next=vi.fn();await requireAdmin(requestFor(),{} as Response,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));
 });
 it.each(["admin", "owner"])("allows %s to read reports", async role => {
  resolveUser({role,email:"test@example.com"});const next=vi.fn();await requireReports(requestFor(),{} as Response,next);expect(next).toHaveBeenCalledWith();
 });
 it.each(["user", "manager"])("denies %s financial reports", async role => {
  resolveUser({role,email:"test@example.com"});const next=vi.fn();await requireReports(requestFor(),{} as Response,next);expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));
 });
});
