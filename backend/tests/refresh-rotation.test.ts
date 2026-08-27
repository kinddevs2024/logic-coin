import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mongoMocks = vi.hoisted(() => ({
  startSession: vi.fn()
}));

const refreshSessionMocks = vi.hoisted(() => ({
  create: vi.fn(),
  exists: vi.fn(),
  findOne: vi.fn(),
  updateMany: vi.fn(),
  updateOne: vi.fn()
}));

vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return {
    ...actual,
    models: actual.models ?? {},
    default: {
      ...actual.default,
      startSession: mongoMocks.startSession
    }
  };
});

vi.mock("../src/models/RefreshSession.js", () => ({
  RefreshSession: refreshSessionMocks
}));

import {
  isAccessSessionActive,
  rotateRefreshToken
} from "../src/services/token.service.js";

function transactionalSession() {
  return {
    withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
    endSession: vi.fn(async () => undefined)
  };
}

describe("refresh-token session families", () => {
  beforeEach(() => {
    refreshSessionMocks.updateMany.mockResolvedValue({ modifiedCount: 1 });
    refreshSessionMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("revokes the whole family when a rotated token is presented again", async () => {
    const databaseSession = transactionalSession();
    mongoMocks.startSession.mockResolvedValue(databaseSession);
    const userId = new Types.ObjectId();
    refreshSessionMocks.findOne.mockReturnValue({
      session: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        userId,
        familyId: "family-123",
        revokedAt: new Date(),
        replacedByHash: "replacement-hash",
        expiresAt: new Date(Date.now() + 60_000)
      })
    });

    await expect(rotateRefreshToken("r".repeat(48))).rejects.toMatchObject({
      statusCode: 401,
      code: "refresh_token_reuse_detected"
    });

    expect(refreshSessionMocks.updateMany).toHaveBeenCalledWith(
      { userId, familyId: "family-123" },
      {
        $set: expect.objectContaining({
          revokeReason: "reuse_detected",
          revokedAt: expect.any(Date),
          reuseDetectedAt: expect.any(Date)
        })
      },
      { session: databaseSession }
    );
    expect(databaseSession.endSession).toHaveBeenCalledOnce();
  });

  it("preserves the original absolute expiry when rotating an active token", async () => {
    const databaseSession = transactionalSession();
    mongoMocks.startSession.mockResolvedValue(databaseSession);
    const userId = new Types.ObjectId();
    const expiresAt = new Date(Date.now() + 86_400_000);
    refreshSessionMocks.findOne.mockReturnValue({
      session: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        userId,
        familyId: "family-456",
        expiresAt
      })
    });
    const replacementSessionId = new Types.ObjectId();
    refreshSessionMocks.create.mockResolvedValue([{ _id: replacementSessionId }]);

    const result = await rotateRefreshToken("s".repeat(48));

    expect(refreshSessionMocks.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId,
          familyId: "family-456",
          expiresAt
        })
      ],
      { session: databaseSession }
    );
    expect(result.tokens.refreshTokenExpiresAt).toBe(expiresAt.toISOString());
    expect(result.tokens.refreshToken).not.toBe("s".repeat(48));
  });

  it("checks revocation and expiry before accepting an access-token session", async () => {
    const userId = new Types.ObjectId();
    const sessionId = new Types.ObjectId().toString();
    refreshSessionMocks.exists.mockResolvedValue({ _id: sessionId });

    await expect(isAccessSessionActive(userId, sessionId)).resolves.toBe(true);
    expect(refreshSessionMocks.exists).toHaveBeenCalledWith({
      _id: sessionId,
      userId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: expect.any(Date) }
    });
  });
});
