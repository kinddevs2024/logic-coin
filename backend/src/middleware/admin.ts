import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { User } from "../models/User.js";
import { verifyAdminToken } from "../services/admin-auth.service.js";

export function requireAdminToken(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    next(new ApiError(401, "admin_authentication_required", "Administrator token is required"));
    return;
  }

  try {
    const payload = verifyAdminToken(authorization.slice(7));
    request.adminAuth = {
      subject: payload.sub,
      ...(payload.jti ? { tokenId: payload.jti } : {})
    };
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdmin(
  request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findById(request.auth!.userId).select("role email").lean();
    const email = user?.email?.toLowerCase();
    if (!user || (user.role !== "admin" && (!email || !env.ADMIN_EMAILS.includes(email)))) {
      throw new ApiError(403, "admin_required", "Administrator access is required");
    }
    next();
  } catch (error) {
    next(error);
  }
}
