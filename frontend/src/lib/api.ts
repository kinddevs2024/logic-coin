import type {
  ActivityOverview,
  BonusKind,
  BonusOverview,
  BootstrapPayload,
  Language,
  LogicTask,
  ReferralOverview,
  User,
  UserPreferences,
  Wallet,
  Withdrawal,
  WithdrawalOverview,
} from "@/types";
import type { ThemeMode } from "@/constants/theme";
import { useAppStore } from "@/store/app-store";
import { Platform } from "react-native";

const defaultApiUrl =
  Platform.OS === "web"
    ? "/api/v1"
    : Platform.OS === "android"
      ? "http://10.0.2.2:4000/api/v1"
      : "http://localhost:4000/api/v1";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(
  /\/+$/,
  "",
);

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; skipAuthRefresh?: boolean } = {},
): Promise<T> {
  const { token, skipAuthRefresh, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  headers.set("Accept", "application/json");
  if (fetchOptions.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401 && token && !skipAuthRefresh) {
    const refreshedToken = await refreshAccessToken(token);
    return request<T>(path, {
      ...fetchOptions,
      token: refreshedToken,
      skipAuthRefresh: true,
    });
  }

  const payload = (await response.json().catch(() => ({}))) as
    | { data?: T }
    | ApiErrorBody;

  if (!response.ok) {
    const body = payload as ApiErrorBody;
    throw new ApiError(
      body.error?.message || body.message || "Request failed",
      response.status,
      body.error?.code,
    );
  }

  return ("data" in payload ? payload.data : payload) as T;
}

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
  tokenType?: "Bearer";
};

export type AuthResult = {
  user: User;
  tokens: AuthTokens;
};

let refreshPromise: Promise<AuthResult> | null = null;

async function refreshAccessToken(expiredToken: string): Promise<string> {
  const state = useAppStore.getState();
  if (state.accessToken && state.accessToken !== expiredToken) {
    return state.accessToken;
  }
  if (!state.refreshToken) {
    state.logout();
    throw new ApiError("Your session has expired", 401, "session_expired");
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: state.refreshToken }),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | { data?: AuthResult }
        | ApiErrorBody;
      if (!response.ok) {
        const body = payload as ApiErrorBody;
        throw new ApiError(
          body.error?.message || body.message || "Session refresh failed",
          response.status,
          body.error?.code,
        );
      }
      const result = ("data" in payload ? payload.data : payload) as AuthResult;
      useAppStore.getState().authenticate({
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        balanceUnits: result.user.wallet?.availableUnits,
      });
      return result;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  try {
    const result = await refreshPromise;
    return result.tokens.accessToken;
  } catch (error) {
    if (
      error instanceof ApiError &&
      [400, 401, 403].includes(error.status)
    ) {
      useAppStore.getState().logout();
    }
    throw error;
  }
}

export const authApi = {
  startEmail(email: string) {
    return request<{
      email: string;
      flowToken: string;
      verification?: { expiresInSeconds?: number };
    }>("/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  completeEmail(input: { email: string; code: string; flowToken: string }) {
    return request<AuthResult>("/auth/email/complete", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  register(input: { name: string; email: string; password: string }) {
    return request<{
      userId: string;
      email: string;
      registrationToken: string;
      verification?: { expiresAt?: string };
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  login(input: { email: string; password: string }) {
    return request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  refresh(refreshToken: string) {
    return request<AuthResult>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },
  verifyEmail(input: {
    email: string;
    code: string;
    registrationToken: string;
  }) {
    return request<AuthResult>("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  resendCode(email: string) {
    return request<{ sent: boolean }>("/auth/email/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  google(idToken: string) {
    return request<AuthResult>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
  },
  yandexStart(redirectUri: string) {
    return request<{
      authorizationUrl: string;
      stateExpiresInSeconds: number;
    }>(`/auth/yandex/start?redirectUri=${encodeURIComponent(redirectUri)}`);
  },
  yandexExchange(input: { code: string; state: string }) {
    return request<AuthResult>("/auth/yandex/exchange", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  telegramStart() {
    return request<{
      flowId: string;
      pollToken: string;
      botUrl: string;
      expiresInSeconds: number;
    }>("/auth/telegram/start", { method: "POST" });
  },
  telegramStatus(input: { flowId: string; pollToken: string }) {
    return request<
      | { status: "pending" }
      | ({ status: "complete" } & AuthResult)
    >("/auth/telegram/status", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  telegramComplete(resumeToken: string) {
    return request<AuthResult>("/auth/telegram/complete", {
      method: "POST",
      body: JSON.stringify({ resumeToken }),
    });
  },
  telegramMiniApp(initData: string) {
    return request<AuthResult>("/auth/telegram/mini-app", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
  },
  logout(token: string, refreshToken?: string | null) {
    return request<{ success: boolean }>("/auth/logout", {
      method: "POST",
      token,
      skipAuthRefresh: true,
      body: JSON.stringify({ refreshToken }),
    });
  },
  yandexStartUrl: `${API_URL}/auth/yandex/start`,
};

type ServerTask = Partial<LogicTask> & {
  key?: string;
  identifier?: string;
  reward?: number;
  rewardCents?: number;
  rewardUnits?: number;
  title?: string;
  description?: string;
  state?: {
    available?: boolean;
    remainingToday?: number;
    cooldownRemainingSeconds?: number;
  };
};

export const tasksApi = {
  async list(token: string) {
    const payload = await request<
      ServerTask[] | { tasks?: ServerTask[] }
    >("/tasks", { token });
    return Array.isArray(payload) ? payload : (payload.tasks ?? []);
  },
  claim(taskIdentifier: string, token: string) {
    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return request<{
      claim?: {
        rewardUnits?: number;
        rewardCents?: number;
      };
      wallet?: {
        availableUnits?: number;
        availableCents?: number;
      };
    }>(`/tasks/${encodeURIComponent(taskIdentifier)}/claim`, {
      method: "POST",
      token,
      body: JSON.stringify({ idempotencyKey }),
    });
  },
};

export const bootstrapApi = {
  get(token: string) {
    return request<BootstrapPayload>("/bootstrap", { token });
  },
};

export const activityApi = {
  list(
    token: string,
    range: { from?: string; to?: string } = {},
  ) {
    const search = new URLSearchParams();
    if (range.from) search.set("from", range.from);
    if (range.to) search.set("to", range.to);
    const suffix = search.size ? `?${search.toString()}` : "";
    return request<ActivityOverview>(`/activity${suffix}`, { token });
  },
  checkIn(token: string) {
    return request<{ day: ActivityOverview["days"][number] }>(
      "/activity/check-in",
      { method: "POST", token },
    );
  },
};

export const bonusesApi = {
  async overview(token: string) {
    const payload = await request<{ bonuses: BonusOverview }>("/bonuses", {
      token,
    });
    return payload.bonuses;
  },
  claim(kind: BonusKind, token: string) {
    return request<{
      claim: {
        id: string;
        key: string;
        kind: BonusKind;
        rewardUnits: number;
        rewardCents: number;
        claimedAt: string;
        idempotentReplay: boolean;
      };
      wallet: Wallet;
    }>(`/bonuses/${kind}/claim`, { method: "POST", token });
  },
};

export const referralsApi = {
  async overview(token: string) {
    const payload = await request<{ referral: ReferralOverview }>(
      "/referrals",
      { token },
    );
    return payload.referral;
  },
};

export const withdrawalsApi = {
  overview(token: string) {
    return request<WithdrawalOverview>("/withdrawals", { token });
  },
  create(
    input: { amountCents: number; accountLabel?: string },
    token: string,
  ) {
    const idempotencyKey = `withdraw-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 12)}`;
    return request<{
      sandbox: true;
      withdrawal: Withdrawal;
      wallet: Wallet;
      adminNotification: string;
    }>("/withdrawals", {
      method: "POST",
      token,
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        amountCents: input.amountCents,
        method: "sandbox",
        ...(input.accountLabel ? { accountLabel: input.accountLabel } : {}),
        idempotencyKey,
      }),
    });
  },
};

export const meApi = {
  async get(token: string) {
    const payload = await request<{ user: User }>("/me", { token });
    return payload.user;
  },
  async updateProfile(
    input: {
      name?: string;
      avatarUrl?: string | null;
      savingsGoalCents?: number;
    },
    token: string,
  ) {
    const payload = await request<{ user: User }>("/me", {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    });
    return payload.user;
  },
  async preferences(token: string) {
    const payload = await request<{ preferences: UserPreferences }>(
      "/me/preferences",
      { token },
    );
    return payload.preferences;
  },
  async updatePreferences(
    input: {
      language?: Language;
      theme?: ThemeMode;
      notificationsEnabled?: boolean;
      dailyReminderEnabled?: boolean;
      timezone?: string;
    },
    token: string,
  ) {
    const payload = await request<{ preferences: UserPreferences }>(
      "/me/preferences",
      {
        method: "PATCH",
        token,
        body: JSON.stringify(input),
      },
    );
    return payload.preferences;
  },
};

export { API_URL };
