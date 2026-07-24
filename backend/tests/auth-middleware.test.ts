import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tokenServiceMocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  isAccessSessionActive: vi.fn()
}));

vi.mock("../src/services/token.service.js", () => tokenServiceMocks);

import { requireAuth } from "../src/middleware/auth.js";

function requestWithBearer(token = "access-token"): Request {
  return {
    header: vi.fn((name: string) =>
      name.toLowerCase() === "authorization" ? `Bearer ${token}` : undefined
    )
  } as unknown as Request;
}

describe("access-token session binding", () => {
  beforeEach(() => {
    tokenServiceMocks.verifyAccessToken.mockReturnValue({
      sub: new Types.ObjectId().toString(),
      sid: new Types.ObjectId().toString(),
      type: "access"
    });
  });

  it("rejects an otherwise valid JWT after its refresh session is revoked", async () => {
    tokenServiceMocks.isAccessSessionActive.mockResolvedValue(false);
    const request = requestWithBearer();
    const next = vi.fn();

    await requireAuth(request, {} as Response, next as NextFunction);

    expect(tokenServiceMocks.isAccessSessionActive).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: "invalid_access_session"
      })
    );
    expect(request.auth).toBeUndefined();
  });

  it("attaches identity only while the backing session is active", async () => {
    tokenServiceMocks.isAccessSessionActive.mockResolvedValue(true);
    const request = requestWithBearer();
    const next = vi.fn();

    await requireAuth(request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(request.auth?.userId).toBeInstanceOf(Types.ObjectId);
    expect(request.auth?.sessionId).toBeTypeOf("string");
  });
});
