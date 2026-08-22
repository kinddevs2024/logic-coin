import { OAuth2Client } from "google-auth-library";
import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import {
  generatePkceVerifier,
  hashOAuthBinding,
  normalizeEmail,
  pkceS256Challenge
} from "../lib/crypto.js";
import { OAuthChallenge } from "../models/OAuthChallenge.js";
import { User } from "../models/User.js";
import { createUser, processReferralSignupReward } from "./user.service.js";

let googleClient: OAuth2Client | null = null;

async function linkExistingSocialUser(input: {
  user: {
    _id: mongoose.Types.ObjectId;
    emailVerifiedAt?: Date | null;
    avatarUrl?: string | null;
  };
  providerPath: "providers.googleSub" | "providers.yandexSub";
  providerSubject: string;
  avatarUrl?: string;
}) {
  const now = new Date();
  const commonSet = {
    [input.providerPath]: input.providerSubject,
    lastLoginAt: now,
    ...(!input.user.avatarUrl && input.avatarUrl ? { avatarUrl: input.avatarUrl } : {})
  };

  if (!input.user.emailVerifiedAt) {
    const claimedUnverifiedAccount = await User.findOneAndUpdate(
      { _id: input.user._id, emailVerifiedAt: { $exists: false } },
      {
        $set: {
          ...commonSet,
          emailVerifiedAt: now
        },
        // A pre-created, unverified local password must never become valid
        // merely because the actual mailbox owner signs in with a provider.
        $unset: {
          passwordHash: 1,
          registrationTokenHash: 1,
          registrationTokenExpiresAt: 1
        }
      },
      { new: true }
    );
    if (claimedUnverifiedAccount) {
      return claimedUnverifiedAccount;
    }
  }

  const linkedUser = await User.findOneAndUpdate(
    { _id: input.user._id },
    { $set: commonSet },
    { new: true }
  );
  if (!linkedUser) {
    throw new ApiError(404, "account_not_found", "Account not found");
  }
  return linkedUser;
}

async function processNewSocialReferral(userId: mongoose.Types.ObjectId): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await processReferralSignupReward(userId, session);
    });
  } finally {
    await session.endSession();
  }
}

export async function authenticateGoogle(idToken: string, referralCode?: string) {
  const validClientIds = [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_ID_WEB,
    env.GOOGLE_CLIENT_ID_MOBILE
  ].filter(Boolean) as string[];

  if (validClientIds.length === 0) {
    throw new ApiError(503, "google_auth_unavailable", "Google sign-in is not configured");
  }

  googleClient ??= new OAuth2Client();

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: validClientIds
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("Google token verification failed:", error);
    throw new ApiError(401, "invalid_google_token", "Google ID token is invalid");
  }

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new ApiError(400, "google_email_unavailable", "Google account must have a verified email");
  }

  const email = normalizeEmail(payload.email);
  let user = await User.findOne({
    $or: [{ "providers.googleSub": payload.sub }, { email }]
  });
  let created = false;

  if (!user) {
    user = await createUser({
      email,
      name: payload.name || email.split("@")[0] || "Logic Coin user",
      emailVerifiedAt: new Date(),
      googleSub: payload.sub,
      ...(referralCode ? { referralCode } : {})
    });
    created = true;
  } else {
    const conflicting = await User.exists({
      "providers.googleSub": payload.sub,
      _id: { $ne: user._id }
    });
    if (conflicting) {
      throw new ApiError(409, "google_account_conflict", "Google account is already linked");
    }
    user = await linkExistingSocialUser({
      user,
      providerPath: "providers.googleSub",
      providerSubject: payload.sub,
      ...(payload.picture ? { avatarUrl: payload.picture } : {})
    });
  }

  if (created) {
    await processNewSocialReferral(user._id);
  }
  return user;
}

interface YandexState extends JwtPayload {
  type: "yandex_state";
  flowId: string;
}

export interface OAuthBindingContext {
  deviceId?: string;
  userAgent?: string;
}

function allowedYandexRedirects(): string[] {
  return env.YANDEX_REDIRECT_URIS.length > 0
    ? env.YANDEX_REDIRECT_URIS
    : [
        `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/oauth/yandex`,
        `${env.API_PUBLIC_URL.replace(/\/$/, "")}/api/v1/auth/yandex/callback`
      ];
}

export async function createYandexAuthorization(input: {
  redirectUri?: string;
  referralCode?: string;
  binding: OAuthBindingContext;
}) {
  if (!env.YANDEX_CLIENT_ID || !env.YANDEX_CLIENT_SECRET) {
    throw new ApiError(503, "yandex_auth_unavailable", "Yandex sign-in is not configured");
  }
  const redirectUri = input.redirectUri ?? allowedYandexRedirects()[0]!;
  if (!allowedYandexRedirects().includes(redirectUri)) {
    throw new ApiError(400, "invalid_redirect_uri", "Yandex redirect URI is not allowed");
  }

  const bindingHash = hashOAuthBinding("yandex", input.binding);
  if (!bindingHash) {
    throw new ApiError(
      400,
      "oauth_binding_required",
      "A device identifier or User-Agent is required for OAuth"
    );
  }
  const flowId = randomUUID();
  const codeVerifier = generatePkceVerifier();
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await OAuthChallenge.create({
    provider: "yandex",
    flowId,
    bindingHash,
    redirectUri,
    ...(input.referralCode
      ? { referralCode: input.referralCode.trim().toUpperCase() }
      : {}),
    codeVerifier,
    expiresAt
  });

  const state = jwt.sign(
    {
      type: "yandex_state",
      flowId
    },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: env.JWT_ISSUER,
      audience: "logic-coin-yandex-oauth",
      expiresIn: "10m",
      jwtid: flowId
    }
  );
  const url = new URL("https://oauth.yandex.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.YANDEX_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkceS256Challenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("force_confirm", "yes");

  return { authorizationUrl: url.toString(), stateExpiresInSeconds: 600 };
}

function verifyYandexState(state: string): YandexState {
  try {
    const payload = jwt.verify(state, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: "logic-coin-yandex-oauth"
    });
    if (
      typeof payload === "string" ||
      payload.type !== "yandex_state" ||
      typeof payload.flowId !== "string" ||
      payload.flowId.length > 128 ||
      payload.jti !== payload.flowId
    ) {
      throw new Error("Invalid state");
    }
    return payload as YandexState;
  } catch {
    throw new ApiError(400, "invalid_oauth_state", "Yandex OAuth state is invalid or expired");
  }
}

export async function authenticateYandex(
  code: string,
  state: string,
  binding: OAuthBindingContext
) {
  if (!env.YANDEX_CLIENT_ID || !env.YANDEX_CLIENT_SECRET) {
    throw new ApiError(503, "yandex_auth_unavailable", "Yandex sign-in is not configured");
  }
  const statePayload = verifyYandexState(state);
  const bindingHash = hashOAuthBinding("yandex", binding);
  if (!bindingHash) {
    throw new ApiError(400, "invalid_oauth_state", "Yandex OAuth state is invalid or expired");
  }
  const challenge = await OAuthChallenge.findOneAndUpdate(
    {
      provider: "yandex",
      flowId: statePayload.flowId,
      bindingHash,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    },
    { $set: { consumedAt: new Date() } },
    { new: false }
  ).select("+codeVerifier");
  if (!challenge || !allowedYandexRedirects().includes(challenge.redirectUri)) {
    throw new ApiError(400, "invalid_oauth_state", "Yandex OAuth state is invalid or expired");
  }

  const tokenResponse = await fetch("https://oauth.yandex.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env.YANDEX_CLIENT_ID,
      client_secret: env.YANDEX_CLIENT_SECRET,
      redirect_uri: challenge.redirectUri,
      code_verifier: challenge.codeVerifier
    }),
    signal: AbortSignal.timeout(8_000)
  });
  if (!tokenResponse.ok) {
    throw new ApiError(401, "yandex_code_exchange_failed", "Yandex authorization code was rejected");
  }
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new ApiError(502, "yandex_token_missing", "Yandex did not return an access token");
  }

  const profileResponse = await fetch(
    "https://login.yandex.ru/info?format=json&with_openid_identity=1",
    {
      headers: { authorization: `OAuth ${tokenData.access_token}` },
      signal: AbortSignal.timeout(8_000)
    }
  );
  if (!profileResponse.ok) {
    throw new ApiError(401, "yandex_profile_failed", "Could not read the Yandex profile");
  }
  const profile = (await profileResponse.json()) as {
    id?: string;
    default_email?: string;
    real_name?: string;
    display_name?: string;
    default_avatar_id?: string;
  };
  if (!profile.id || !profile.default_email) {
    throw new ApiError(400, "yandex_email_unavailable", "Yandex account must expose an email");
  }

  const email = normalizeEmail(profile.default_email);
  let user = await User.findOne({
    $or: [{ "providers.yandexSub": profile.id }, { email }]
  });
  let created = false;

  if (!user) {
    user = await createUser({
      email,
      name: profile.real_name || profile.display_name || email.split("@")[0] || "Logic Coin user",
      emailVerifiedAt: new Date(),
      yandexSub: profile.id,
      ...(challenge.referralCode ? { referralCode: challenge.referralCode } : {})
    });
    created = true;
  } else {
    const conflicting = await User.exists({
      "providers.yandexSub": profile.id,
      _id: { $ne: user._id }
    });
    if (conflicting) {
      throw new ApiError(409, "yandex_account_conflict", "Yandex account is already linked");
    }
    user = await linkExistingSocialUser({
      user,
      providerPath: "providers.yandexSub",
      providerSubject: profile.id,
      ...(profile.default_avatar_id
        ? {
            avatarUrl: `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
          }
        : {})
    });
  }

  if (created) {
    await processNewSocialReferral(user._id);
  }
  return user;
}
