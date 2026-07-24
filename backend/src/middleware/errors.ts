import type { ErrorRequestHandler, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { ApiError } from "../lib/api-error.js";
import { env } from "../config/env.js";

export const attachRequestId: RequestHandler = (request, response, next) => {
  const incoming = request.header("x-request-id");
  request.requestId = incoming && incoming.length <= 100 ? incoming : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
};

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, "route_not_found", "API route not found"));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const mongoError = error as {
    code?: number;
    keyPattern?: Record<string, number>;
    name?: string;
    message?: string;
  };

  let apiError: ApiError;
  if (error instanceof ApiError) {
    apiError = error;
  } else if ((error as { type?: string }).type === "entity.parse.failed") {
    apiError = new ApiError(400, "invalid_json", "Request body contains invalid JSON");
  } else if ((error as { type?: string }).type === "entity.too.large") {
    apiError = new ApiError(413, "payload_too_large", "Request body is too large");
  } else if (mongoError.code === 11_000) {
    apiError = new ApiError(409, "duplicate_resource", "Resource already exists");
  } else if (mongoError.name === "CastError") {
    apiError = new ApiError(400, "invalid_identifier", "Resource identifier is invalid");
  } else {
    apiError = new ApiError(500, "internal_error", "An unexpected error occurred");
  }

  if (apiError.statusCode >= 500 && env.NODE_ENV !== "test") {
    console.error(`[${request.requestId}]`, error);
  }

  response.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
      requestId: request.requestId
    }
  });
};
