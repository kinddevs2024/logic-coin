import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  APP_PUBLIC_URL: z.string().url().optional(),
  API_PUBLIC_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  DEFAULT_TIMEZONE: z.string().default("UTC"),
  MONGODB_URI: z.string().optional(),
  MONGODB_SYNC_TARGET_URI: z.string().optional(),
  MONGODB_AUTO_INDEX: booleanFromString.default("true"),
  JWT_SECRET: z.string().optional(),
  JWT_ISSUER: z.string().default("logic-coin-api"),
  JWT_AUDIENCE: z.string().default("logic-coin-app"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  OTP_PEPPER: z.string().optional(),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  OTP_EXPOSE_CODE: booleanFromString.default("false"),
  EMAIL_ENABLED: booleanFromString.default("false"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_SECURE: booleanFromString.default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  YANDEX_CLIENT_ID: z.string().optional(),
  YANDEX_CLIENT: z.string().optional(),
  YANDEX_CLIENT_SECRET: z.string().optional(),
  YANDEX_REDIRECT_URIS: z.string().default(""),
  UNIT_VALUE_CENTS: z.coerce.number().int().min(1).max(100).default(1),
  MIN_WITHDRAWAL_CENTS: z.coerce.number().int().min(100).default(1000),
  REFERRAL_SIGNUP_REWARD_UNITS: z.coerce.number().int().min(0).max(100_000).default(50),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).max(256).optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional()
});

const raw = rawEnvSchema.parse(process.env);
const developmentSecret = "logic-coin-development-secret-change-before-production";
const toHttpsOrigin = (host: string | undefined) =>
  host ? (host.startsWith("http") ? host : `https://${host}`) : undefined;
const productionVercelUrl = toHttpsOrigin(raw.VERCEL_PROJECT_PRODUCTION_URL);
const deploymentVercelUrl = toHttpsOrigin(raw.VERCEL_URL);
const inferredPublicUrl = productionVercelUrl ?? deploymentVercelUrl;
const appPublicUrl = raw.APP_PUBLIC_URL ?? inferredPublicUrl ?? "http://localhost:8081";
const apiPublicUrl = raw.API_PUBLIC_URL ?? inferredPublicUrl ?? "http://localhost:4000";
const corsOrigins =
  raw.CORS_ORIGINS ??
  (inferredPublicUrl
    ? [productionVercelUrl, deploymentVercelUrl].filter(Boolean).join(",")
    : "http://localhost:8081,http://localhost:19006");

if (
  raw.NODE_ENV === "production" &&
  (!raw.JWT_SECRET || raw.JWT_SECRET.length < 32 || !raw.OTP_PEPPER || raw.OTP_PEPPER.length < 32)
) {
  throw new Error("JWT_SECRET and OTP_PEPPER must each contain at least 32 characters in production");
}

if (raw.JWT_SECRET && raw.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters");
}

if (raw.OTP_PEPPER && raw.OTP_PEPPER.length < 32) {
  throw new Error("OTP_PEPPER must contain at least 32 characters");
}

try {
  new Intl.DateTimeFormat("en-US", { timeZone: raw.DEFAULT_TIMEZONE }).format();
} catch {
  throw new Error(`Invalid DEFAULT_TIMEZONE: ${raw.DEFAULT_TIMEZONE}`);
}

export const env = Object.freeze({
  ...raw,
  APP_PUBLIC_URL: appPublicUrl,
  API_PUBLIC_URL: apiPublicUrl,
  MONGODB_URI: raw.MONGODB_URI ?? raw.MONGODB_SYNC_TARGET_URI,
  JWT_SECRET: raw.JWT_SECRET ?? developmentSecret,
  OTP_PEPPER: raw.OTP_PEPPER ?? `${developmentSecret}-otp`,
  YANDEX_CLIENT_ID: raw.YANDEX_CLIENT_ID ?? raw.YANDEX_CLIENT,
  TELEGRAM_BOT_TOKEN: raw.TELEGRAM_BOT_TOKEN ?? raw.TELEGRAM_BOT,
  CORS_ORIGINS: corsOrigins.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  YANDEX_REDIRECT_URIS: raw.YANDEX_REDIRECT_URIS.split(",")
    .map((uri) => uri.trim())
    .filter(Boolean)
});

export type AppEnv = typeof env;
