import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { env } from "../config/env.js";
import {
  generateRegistrationToken,
  hashOpaqueToken,
  normalizeEmail,
  opaqueTokenMatches
} from "../lib/crypto.js";
import { User } from "../models/User.js";
import { authLimiter, otpLimiter } from "../middleware/rate-limits.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { consumeOtp, createAndSendOtp } from "../services/otp.service.js";
import {
  issueTokenPair,
  revokeAllUserSessions,
  revokeRefreshToken,
  revokeSessionById,
  rotateRefreshToken,
  type SessionContext
} from "../services/token.service.js";
import { createUser, processReferralSignupReward } from "../services/user.service.js";
import { serializeUser } from "../services/serialization.service.js";
import { authenticateGoogle } from "../services/social-auth.service.js";
import {
  assertTelegramWebhookSecret,
  authenticateTelegram,
  completeTelegramResume,
  confirmTelegramBotUpdate,
  createTelegramLogin,
  pollTelegramLogin,
  verifyTelegramMiniApp
} from "../services/telegram-auth.service.js";
import { assertDeviceNotBanned, registerDeviceAccount } from "../services/device-security.service.js";

const router = Router();

const emailSchema = z.string().trim().email().max(254).transform(normalizeEmail);
const passwordSchema = z.string().min(8).max(72);
const deviceIdSchema = z.string().trim().min(1).max(160).optional();
const countryCodeSchema = z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()).optional();
const registrationTokenSchema = z.string().min(32).max(1_024);
const REGISTRATION_TOKEN_TTL_MS = 24 * 60 * 60_000;

const emailStartSchema = z
  .object({
    email: emailSchema,
    referralCode: z.string().trim().min(4).max(32).optional(),
    deviceId: deviceIdSchema,
    countryCode: countryCodeSchema
  })
  .strict();

const emailCompleteSchema = z
  .object({
    email: emailSchema,
    code: z.string().regex(/^\d{6}$/),
    flowToken: registrationTokenSchema,
    deviceId: deviceIdSchema
  })
  .strict();

const passwordSetupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    setupToken: registrationTokenSchema,
    deviceId: deviceIdSchema
  })
  .strict();

const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().min(1).max(80),
    referralCode: z.string().trim().min(4).max(32).optional(),
    deviceId: deviceIdSchema,
    countryCode: countryCodeSchema
  })
  .strict();

const verifySchema = z
  .object({
    email: emailSchema,
    code: z.string().regex(/^\d{6}$/),
    registrationToken: registrationTokenSchema,
    deviceId: deviceIdSchema
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    deviceId: deviceIdSchema
  })
  .strict();

const refreshSchema = z
  .object({
    refreshToken: z.string().min(32).max(1_024),
    deviceId: deviceIdSchema
  })
  .strict();

const logoutSchema = z
  .object({
    refreshToken: z.string().min(32).max(1_024).optional(),
    allDevices: z.boolean().default(false)
  })
  .strict();

const googleSchema = z
  .object({
    idToken: z.string().min(100).max(20_000),
    deviceId: deviceIdSchema,
    referralCode: z.string().trim().min(4).max(32).optional(),
    countryCode: countryCodeSchema
  })
  .strict();

function sessionContext(request: Request, deviceId?: string): SessionContext {
  const userAgent = request.header("user-agent");
  return {
    ...(deviceId ? { deviceId } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(request.ip ? { ip: request.ip } : {})
  };
}

router.post(
  "/email/start",
  otpLimiter,
  validateBody(emailStartSchema),
  async (request, response) => {
    const { email, referralCode, deviceId, countryCode } = request.body as z.infer<
      typeof emailStartSchema
    >;
    await assertDeviceNotBanned(deviceId);
    const existing = await User.findOne({ email }).select("+passwordHash");
    if (existing?.emailVerifiedAt && existing.passwordHash) {
      response.json({ data: { email, mode: "password" as const } });
      return;
    }

    const flowToken = generateRegistrationToken();
    const registrationTokenHash = hashOpaqueToken(flowToken);
    const registrationTokenExpiresAt = new Date(
      Date.now() + REGISTRATION_TOKEN_TTL_MS
    );
    let user = existing;

    if (!user) {
      const localName = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
      user = await createUser({
        email,
        name: localName || "Logic member",
        registrationTokenHash,
        registrationTokenExpiresAt,
        ...(referralCode ? { referralCode } : {}),
        ...(countryCode ? { countryCode } : {})
      });
    } else {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            registrationTokenHash,
            registrationTokenExpiresAt,
            ...(countryCode && !user.countryCode ? { countryCode } : {})
          }
        }
      );
    }

    const verification = await createAndSendOtp(email);
    response.status(202).json({
      data: {
        email,
        mode: "verification" as const,
        flowToken,
        verification
      }
    });
  }
);

router.post(
  "/email/verify-code",
  otpLimiter,
  validateBody(emailCompleteSchema),
  async (request, response) => {
    const { email, code, flowToken } = request.body as z.infer<
      typeof emailCompleteSchema
    >;
    const existing = await User.findOne({ email }).select(
      "+registrationTokenHash +registrationTokenExpiresAt"
    );
    if (
      !existing?.registrationTokenHash ||
      !existing.registrationTokenExpiresAt ||
      existing.registrationTokenExpiresAt.getTime() <= Date.now() ||
      !opaqueTokenMatches(flowToken, existing.registrationTokenHash)
    ) {
      throw new ApiError(400, "invalid_email_flow", "Email login has expired");
    }

    await consumeOtp(email, code);
    const wasVerified = Boolean(existing.emailVerifiedAt);
    const setupToken = generateRegistrationToken();
    const setupTokenHash = hashOpaqueToken(setupToken);
    const setupTokenExpiresAt = new Date(Date.now() + REGISTRATION_TOKEN_TTL_MS);
    const user = await User.findOneAndUpdate(
      {
        _id: existing._id,
        registrationTokenHash: hashOpaqueToken(flowToken),
        registrationTokenExpiresAt: { $gt: new Date() }
      },
      {
        $set: {
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          registrationTokenHash: setupTokenHash,
          registrationTokenExpiresAt: setupTokenExpiresAt
        }
      },
      { new: true }
    );
    if (!user) {
      throw new ApiError(400, "invalid_email_flow", "Email login has expired");
    }

    if (!wasVerified) {
      const referralSession = await mongoose.startSession();
      try {
        await referralSession.withTransaction(async () => {
          await processReferralSignupReward(user._id, referralSession);
        });
      } finally {
        await referralSession.endSession();
      }
    }

    response.json({ data: { email, setupToken } });
  }
);

router.post(
  "/email/set-password",
  authLimiter,
  validateBody(passwordSetupSchema),
  async (request, response) => {
    const { email, password, setupToken, deviceId } = request.body as z.infer<
      typeof passwordSetupSchema
    >;
    const existing = await User.findOne({ email }).select(
      "+registrationTokenHash +registrationTokenExpiresAt"
    );
    if (
      !existing?.emailVerifiedAt ||
      !existing.registrationTokenHash ||
      !existing.registrationTokenExpiresAt ||
      existing.registrationTokenExpiresAt.getTime() <= Date.now() ||
      !opaqueTokenMatches(setupToken, existing.registrationTokenHash)
    ) {
      throw new ApiError(400, "invalid_password_setup", "Password setup has expired");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = env.ADMIN_EMAILS.includes(email) ? "admin" : existing.role;
    const user = await User.findOneAndUpdate(
      {
        _id: existing._id,
        registrationTokenHash: hashOpaqueToken(setupToken),
        registrationTokenExpiresAt: { $gt: new Date() }
      },
      {
        $set: { passwordHash, role, lastLoginAt: new Date() },
        $unset: { registrationTokenHash: 1, registrationTokenExpiresAt: 1 }
      },
      { new: true }
    );
    if (!user) {
      throw new ApiError(400, "invalid_password_setup", "Password setup has expired");
    }

    await registerDeviceAccount(user._id, deviceId);
    const tokens = await issueTokenPair(user._id, sessionContext(request, deviceId));
    response.json({ data: { user: serializeUser(user), tokens } });
  }
);

router.post("/email/complete", (_request, _response) => {
  throw new ApiError(
    410,
    "email_flow_upgraded",
    "Verify the email code and create a password to continue"
  );
});

router.post("/telegram/start", authLimiter, async (request, response) => {
  const parsed = z.object({ deviceId: deviceIdSchema }).strict().safeParse(request.body ?? {});
  if (!parsed.success) throw new ApiError(400, "validation_error", "Telegram login data is invalid");
  await assertDeviceNotBanned(parsed.data.deviceId);
  response.status(201).json({ data: await createTelegramLogin() });
});

router.post("/telegram/status", authLimiter, async (request, response) => {
  const parsed = z
    .object({
      flowId: z.string().min(20).max(64),
      pollToken: z.string().min(32).max(256),
      deviceId: deviceIdSchema
    })
    .strict()
    .safeParse(request.body);
  if (!parsed.success) {
    throw new ApiError(400, "validation_error", "Telegram login data is invalid");
  }
  const user = await pollTelegramLogin(parsed.data.flowId, parsed.data.pollToken);
  if (!user) {
    response.status(202).json({ data: { status: "pending" } });
    return;
  }
  const tokens = await issueTokenPair(
    user._id,
    sessionContext(request, parsed.data.deviceId)
  );
  response.json({ data: { status: "complete", user: serializeUser(user), tokens } });
});

router.post("/telegram/complete", authLimiter, async (request, response) => {
  const parsed = z
    .object({
      resumeToken: z.string().min(32).max(256),
      deviceId: deviceIdSchema
    })
    .strict()
    .safeParse(request.body);
  if (!parsed.success) {
    throw new ApiError(400, "validation_error", "Telegram login data is invalid");
  }
  const user = await completeTelegramResume(parsed.data.resumeToken);
  const tokens = await issueTokenPair(
    user._id,
    sessionContext(request, parsed.data.deviceId)
  );
  response.json({ data: { user: serializeUser(user), tokens } });
});

router.post("/telegram/mini-app", authLimiter, async (request, response) => {
  const parsed = z
    .object({ initData: z.string().min(20).max(20_000), deviceId: deviceIdSchema })
    .strict()
    .safeParse(request.body);
  if (!parsed.success) {
    throw new ApiError(400, "validation_error", "Telegram data is invalid");
  }
  const user = await authenticateTelegram(
    verifyTelegramMiniApp(parsed.data.initData)
  );
  const tokens = await issueTokenPair(
    user._id,
    sessionContext(request, parsed.data.deviceId)
  );
  response.json({ data: { user: serializeUser(user), tokens } });
});

router.post("/telegram/webhook", async (request, response) => {
  assertTelegramWebhookSecret(
    request.header("x-telegram-bot-api-secret-token")
  );
  const result = await confirmTelegramBotUpdate(request.body as never);
  response.json({ ok: true, ...result });
});

router.post("/register", authLimiter, validateBody(registerSchema), async (request, response) => {
  const { email, password, name, referralCode, deviceId, countryCode } = request.body as z.infer<typeof registerSchema>;
  await assertDeviceNotBanned(deviceId);
  let user = await User.findOne({ email });
  if (user?.emailVerifiedAt) {
    throw new ApiError(409, "email_already_registered", "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const registrationToken = generateRegistrationToken();
  const registrationTokenHash = hashOpaqueToken(registrationToken);
  const registrationTokenExpiresAt = new Date(Date.now() + REGISTRATION_TOKEN_TTL_MS);
  if (user) {
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, emailVerifiedAt: { $exists: false } },
      {
        $set: {
          passwordHash,
          name,
          registrationTokenHash,
          registrationTokenExpiresAt
        }
      },
      { new: true }
    );
    if (!updatedUser) {
      throw new ApiError(409, "email_already_registered", "An account with this email already exists");
    }
    user = updatedUser;
  } else {
    user = await createUser({
      email,
      name,
      passwordHash,
      registrationTokenHash,
      registrationTokenExpiresAt,
      ...(referralCode ? { referralCode } : {}),
      ...(countryCode ? { countryCode } : {})
    });
  }

  const verification = await createAndSendOtp(email);
  response.status(202).json({
    data: {
      userId: user._id.toString(),
      email,
      registrationToken,
      verification
    }
  });
});

router.post(
  "/email/verify",
  otpLimiter,
  validateBody(verifySchema),
  async (request, response) => {
    const { email, code, registrationToken, deviceId } = request.body as z.infer<
      typeof verifySchema
    >;
    const existing = await User.findOne({ email }).select(
      "+registrationTokenHash +registrationTokenExpiresAt"
    );
    if (!existing) {
      throw new ApiError(404, "account_not_found", "Account not found");
    }
    if (existing.emailVerifiedAt) {
      throw new ApiError(409, "email_already_verified", "Email is already verified");
    }
    if (
      !existing.registrationTokenHash ||
      !existing.registrationTokenExpiresAt ||
      existing.registrationTokenExpiresAt.getTime() <= Date.now() ||
      !opaqueTokenMatches(registrationToken, existing.registrationTokenHash)
    ) {
      throw new ApiError(
        400,
        "invalid_registration_token",
        "Registration session is invalid or expired"
      );
    }
    await consumeOtp(email, code);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const verified = await User.updateOne(
          {
            _id: existing._id,
            emailVerifiedAt: { $exists: false },
            registrationTokenHash: hashOpaqueToken(registrationToken),
            registrationTokenExpiresAt: { $gt: new Date() }
          },
          {
            $set: { emailVerifiedAt: new Date(), lastLoginAt: new Date() },
            $unset: { registrationTokenHash: 1, registrationTokenExpiresAt: 1 }
          },
          { session }
        );
        if (verified.modifiedCount !== 1) {
          throw new ApiError(
            400,
            "invalid_registration_token",
            "Registration session is invalid or expired"
          );
        }
        await processReferralSignupReward(existing._id, session);
      });
    } finally {
      await session.endSession();
    }

    const user = await User.findById(existing._id);
    if (!user) {
      throw new ApiError(404, "account_not_found", "Account not found");
    }
    await registerDeviceAccount(user._id, deviceId);
    const tokens = await issueTokenPair(user._id, sessionContext(request, deviceId));
    response.json({ data: { user: serializeUser(user), tokens } });
  }
);

router.post(
  "/email/resend",
  otpLimiter,
  validateBody(z.object({ email: emailSchema, deviceId: deviceIdSchema }).strict()),
  async (request, response) => {
    const { email, deviceId } = request.body as { email: string; deviceId?: string };
    await assertDeviceNotBanned(deviceId);
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      throw new ApiError(404, "account_not_found", "Account not found");
    }
    if (user.emailVerifiedAt && user.passwordHash) {
      throw new ApiError(409, "email_already_verified", "Email is already verified");
    }
    const verification = await createAndSendOtp(email);
    response.status(202).json({ data: { email, verification } });
  }
);

router.post("/login", authLimiter, validateBody(loginSchema), async (request, response) => {
  const { email, password, deviceId } = request.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email }).select("+passwordHash");
  if (user && !user.passwordHash) {
    throw new ApiError(403, "password_setup_required", "Create a password before signing in");
  }
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, "invalid_credentials", "Email or password is incorrect");
  }
  if (!user.emailVerifiedAt) {
    throw new ApiError(403, "email_not_verified", "Verify your email before signing in");
  }

  user.lastLoginAt = new Date();
  if (env.ADMIN_EMAILS.includes(email)) user.role = "admin";
  await user.save();
  const tokens = await issueTokenPair(user._id, sessionContext(request, deviceId));
  response.json({ data: { user: serializeUser(user), tokens } });
});

router.post("/refresh", authLimiter, validateBody(refreshSchema), async (request, response) => {
  const { refreshToken, deviceId } = request.body as z.infer<typeof refreshSchema>;
  const result = await rotateRefreshToken(refreshToken, sessionContext(request, deviceId));
  const user = await User.findById(result.userId);
  if (!user) {
    throw new ApiError(401, "account_unavailable", "Account is unavailable");
  }
  response.json({ data: { user: serializeUser(user), tokens: result.tokens } });
});

router.post(
  "/logout",
  requireAuth,
  validateBody(logoutSchema),
  async (request, response) => {
    const { refreshToken, allDevices } = request.body as z.infer<typeof logoutSchema>;
    if (allDevices) {
      await revokeAllUserSessions(request.auth!.userId);
    } else if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    } else if (request.auth?.sessionId) {
      await revokeSessionById(request.auth.sessionId, request.auth.userId);
    }
    response.status(204).send();
  }
);

router.post("/google", authLimiter, validateBody(googleSchema), async (request, response) => {
  const { idToken, deviceId, referralCode, countryCode } = request.body as z.infer<typeof googleSchema>;
  await assertDeviceNotBanned(deviceId);
  const { user, created } = await authenticateGoogle(idToken, referralCode);
  if (countryCode && !user.countryCode) {
    user.countryCode = countryCode;
    await user.save();
  }
  if (created) await registerDeviceAccount(user._id, deviceId);
  const tokens = await issueTokenPair(user._id, sessionContext(request, deviceId));
  response.json({ data: { user: serializeUser(user), tokens } });
});

export default router;
