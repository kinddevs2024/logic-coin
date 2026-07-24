import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import mongoose, { type Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { generateRefreshToken, hashOpaqueToken } from "../lib/crypto.js";
import { RefreshSession } from "../models/RefreshSession.js";

export interface SessionContext {
  deviceId?: string;
  userAgent?: string;
  ip?: string;
}

interface AccessPayload extends JwtPayload {
  sub: string;
  sid: string;
  type: "access";
}

function signAccessToken(userId: Types.ObjectId, sessionId: Types.ObjectId): string {
  const options: SignOptions = {
    algorithm: "HS256",
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL as NonNullable<SignOptions["expiresIn"]>,
    jwtid: randomUUID()
  };
  return jwt.sign(
    { sub: userId.toString(), sid: sessionId.toString(), type: "access" },
    env.JWT_SECRET,
    options
  );
}

export async function issueTokenPair(userId: Types.ObjectId, context: SessionContext = {}) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const session = await RefreshSession.create({
    userId,
    tokenHash: hashOpaqueToken(refreshToken),
    familyId: randomUUID(),
    expiresAt,
    ...(context.deviceId ? { deviceId: context.deviceId } : {}),
    ...(context.userAgent ? { userAgent: context.userAgent } : {}),
    ...(context.ip ? { ip: context.ip } : {})
  });

  return {
    accessToken: signAccessToken(userId, session._id),
    refreshToken,
    refreshTokenExpiresAt: expiresAt.toISOString(),
    tokenType: "Bearer" as const
  };
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE
    });
    if (
      typeof payload === "string" ||
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    ) {
      throw new Error("Unexpected token payload");
    }
    return payload as AccessPayload;
  } catch {
    throw new ApiError(401, "invalid_access_token", "Access token is invalid or expired");
  }
}

export async function isAccessSessionActive(
  userId: Types.ObjectId,
  sessionId: string
): Promise<boolean> {
  return Boolean(
    await RefreshSession.exists({
      _id: sessionId,
      userId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    })
  );
}

export async function rotateRefreshToken(refreshToken: string, context: SessionContext = {}) {
  const now = new Date();
  const presentedHash = hashOpaqueToken(refreshToken);
  const replacementToken = generateRefreshToken();
  const replacementHash = hashOpaqueToken(replacementToken);
  const databaseSession = await mongoose.startSession();
  type RotationOutcome =
    | {
        kind: "rotated";
        userId: Types.ObjectId;
        sessionId: Types.ObjectId;
        expiresAt: Date;
      }
    | { kind: "reuse" }
    | { kind: "invalid" };

  const outcome = await (async (): Promise<RotationOutcome> => {
    try {
      return await databaseSession.withTransaction(async (): Promise<RotationOutcome> => {
        const existing = await RefreshSession.findOne({ tokenHash: presentedHash }).session(
          databaseSession
        );
        if (!existing) {
          return { kind: "invalid" };
        }

        if (existing.revokedAt && existing.replacedByHash) {
          const familyFilter = existing.familyId
            ? { userId: existing.userId, familyId: existing.familyId }
            : { userId: existing.userId };
          await RefreshSession.updateMany(
            familyFilter,
            {
              $set: {
                revokedAt: now,
                revokeReason: "reuse_detected",
                reuseDetectedAt: now
              }
            },
            { session: databaseSession }
          );
          return { kind: "reuse" };
        }

        if (existing.revokedAt || existing.expiresAt.getTime() <= now.getTime()) {
          return { kind: "invalid" };
        }

        const familyId = existing.familyId ?? randomUUID();
        // A refresh family has an absolute lifetime. Keeping the original
        // expiration also keeps every rotated-token reuse marker until the
        // family itself expires.
        const expiresAt = existing.expiresAt;
        const [replacementSession] = await RefreshSession.create(
          [
            {
              userId: existing.userId,
              tokenHash: replacementHash,
              familyId,
              expiresAt,
              deviceId: context.deviceId ?? existing.deviceId,
              userAgent: context.userAgent ?? existing.userAgent,
              ip: context.ip ?? existing.ip
            }
          ],
          { session: databaseSession }
        );
        if (!replacementSession) {
          throw new ApiError(500, "refresh_rotation_failed", "Refresh token rotation failed");
        }

        const rotated = await RefreshSession.updateOne(
          { _id: existing._id, revokedAt: { $exists: false } },
          {
            $set: {
              familyId,
              revokedAt: now,
              revokeReason: "rotated",
              replacedByHash: replacementHash
            }
          },
          { session: databaseSession }
        );
        if (rotated.modifiedCount !== 1) {
          throw new ApiError(401, "invalid_refresh_token", "Refresh token is invalid or expired");
        }

        return {
          kind: "rotated",
          userId: existing.userId,
          sessionId: replacementSession._id,
          expiresAt
        };
      });
    } finally {
      await databaseSession.endSession();
    }
  })();

  if (outcome.kind === "reuse") {
    throw new ApiError(
      401,
      "refresh_token_reuse_detected",
      "Refresh token reuse was detected; this session family has been revoked"
    );
  }
  if (outcome.kind !== "rotated") {
    throw new ApiError(401, "invalid_refresh_token", "Refresh token is invalid or expired");
  }
  return {
    userId: outcome.userId,
    tokens: {
      accessToken: signAccessToken(outcome.userId, outcome.sessionId),
      refreshToken: replacementToken,
      refreshTokenExpiresAt: outcome.expiresAt.toISOString(),
      tokenType: "Bearer" as const
    }
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await RefreshSession.updateOne(
    { tokenHash: hashOpaqueToken(refreshToken), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokeReason: "logout" } }
  );
}

export async function revokeAllUserSessions(userId: Types.ObjectId): Promise<void> {
  await RefreshSession.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokeReason: "logout_all" } }
  );
}

export async function revokeSessionById(sessionId: string, userId: Types.ObjectId): Promise<void> {
  await RefreshSession.updateOne(
    { _id: sessionId, userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokeReason: "logout" } }
  );
}
