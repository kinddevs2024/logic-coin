import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { User } from "../models/User.js";

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
