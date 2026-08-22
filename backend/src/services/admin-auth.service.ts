import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";

interface AdminAccessPayload extends JwtPayload {
  sub: "password-admin";
  type: "admin";
}

const adminAudience = `${env.JWT_AUDIENCE}:admin`;

export async function authenticateAdminPassword(password: string) {
  if (!env.ADMIN_PASSWORD_HASH) {
    throw new ApiError(
      503,
      "admin_login_unavailable",
      "Administrator password login is not configured"
    );
  }

  const accepted = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  if (!accepted) {
    throw new ApiError(401, "invalid_admin_credentials", "Administrator password is invalid");
  }

  const options: SignOptions = {
    algorithm: "HS256",
    issuer: env.JWT_ISSUER,
    audience: adminAudience,
    expiresIn: env.ADMIN_TOKEN_TTL as NonNullable<SignOptions["expiresIn"]>,
    jwtid: randomUUID()
  };
  const adminToken = jwt.sign(
    { sub: "password-admin", type: "admin" },
    env.ADMIN_JWT_SECRET,
    options
  );
  const decoded = jwt.decode(adminToken);
  if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") {
    throw new ApiError(500, "admin_token_failed", "Administrator token could not be issued");
  }

  return {
    adminToken,
    expiresAt: new Date(decoded.exp * 1_000).toISOString(),
    tokenType: "Bearer" as const
  };
}

export function verifyAdminToken(token: string): AdminAccessPayload {
  try {
    const payload = jwt.verify(token, env.ADMIN_JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: adminAudience
    });
    if (
      typeof payload === "string" ||
      payload.type !== "admin" ||
      payload.sub !== "password-admin"
    ) {
      throw new Error("Unexpected administrator token payload");
    }
    return payload as AdminAccessPayload;
  } catch {
    throw new ApiError(
      401,
      "invalid_admin_token",
      "Administrator token is invalid or expired"
    );
  }
}
