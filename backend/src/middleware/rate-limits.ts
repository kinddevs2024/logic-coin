import { API_PREFIX } from "../config/constants.js";
import { hasValidMonetagSecret } from "../services/monetag.service.js";
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { MongoRateLimitStore } from "../services/mongo-rate-limit-store.js";

function limiter(namespace: string, windowMs: number, limit: number) {
  return rateLimit({
    // Monetag sends many users' confirmations from the same server IP.
    // Only correctly authenticated callbacks bypass the ordinary per-IP cap.
    skip: (request) => namespace === "global" && request.method === "GET" &&
      request.path === `${API_PREFIX}/ads/monetag/postback` && hasValidMonetagSecret(request.query.secret),
    windowMs,
    limit,
    ...(env.NODE_ENV === "production"
      ? { store: new MongoRateLimitStore(namespace, windowMs), passOnStoreError: true }
      : {}),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "rate_limit_exceeded",
        message: "Too many requests; please try again later"
      }
    }
  });
}

export const globalLimiter = limiter("global", 60_000, 180);
export const authLimiter = limiter("auth", 15 * 60_000, 25);
export const otpLimiter = limiter("otp", 15 * 60_000, 8);
export const rewardLimiter = limiter("reward", 60_000, 30);
export const withdrawalLimiter = limiter("withdrawal", 60 * 60_000, 8);
