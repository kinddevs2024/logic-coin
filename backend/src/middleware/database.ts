import type { NextFunction, Request, Response } from "express";
import { connectToDatabase } from "../config/database.js";
import { ApiError } from "../lib/api-error.js";

export async function requireDatabase(
  _request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database connection failed";
    next(new ApiError(503, "database_unavailable", message));
  }
}
