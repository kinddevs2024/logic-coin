import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ApiError } from "../lib/api-error.js";

export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(
        new ApiError(400, "validation_error", "Request body is invalid", result.error.flatten())
      );
      return;
    }
    request.body = result.data;
    next();
  };
}
