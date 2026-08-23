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
import { requireAdmin } from "../src/middleware/admin.js";

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
