import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { isAccessSessionActive, verifyAccessToken } from "../services/token.service.js";

export async function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    next(new ApiError(401, "authentication_required", "Bearer access token is required"));
    return;
  }

  try {
    const payload = verifyAccessToken(authorization.slice(7));
    if (!Types.ObjectId.isValid(payload.sub) || !Types.ObjectId.isValid(payload.sid)) {
      throw new ApiError(401, "invalid_access_token", "Access token is invalid");
    }
    const userId = new Types.ObjectId(payload.sub);
    if (!(await isAccessSessionActive(userId, payload.sid))) {
      throw new ApiError(401, "invalid_access_session", "Access session is revoked or expired");
    }
    request.auth = {
      userId,
      sessionId: payload.sid
    };
    next();
  } catch (error) {
    next(error);
  }
}
