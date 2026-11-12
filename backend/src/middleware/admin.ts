import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/api-error.js";
import { canManagePlatform, canViewReports } from "../lib/platform-roles.js";
import { User } from "../models/User.js";
function guard(allowed: (role: unknown) => boolean, code: string) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findById(request.auth!.userId).select("role").lean();
      if (!user || !allowed(user.role)) throw new ApiError(403, code, "Access denied");
      next();
    } catch (error) { next(error); }
  };
}
export const requireAdmin = guard(canManagePlatform, "admin_required");
export const requireReports = guard(canViewReports, "reports_required");
