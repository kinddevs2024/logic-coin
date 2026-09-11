import type {
  ActivityOverview,
  BonusKind,
  BonusOverview,
  BootstrapPayload,
  CoinWallet,
  ContestRewardResult,
  GameCatalogItem,
  GiftItem,
  GiftUseEffect,
  Language,
  LeaderboardMetric,
  LeaderboardPayload,
  LogicTask,
  ReferralOverview,
  TodayChallenges,
  PendingContestReward,
  User,
  UserPreferences,
  Wallet,
  Withdrawal,
  WithdrawalOverview,
} from "@/types";
import type { ThemeMode } from "@/constants/theme";
import type { GameId, GamesProgress } from "@/games/progress-store";
import { useAppStore } from "@/store/app-store";
import { Platform } from "react-native";
import { getDeviceId } from "@/lib/device-id";

const defaultApiUrl =
  Platform.OS === "web"
    ? process.env.NODE_ENV === "development"
      ? "http://localhost:4000/api/v1"
      : "/api/v1"
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
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
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
      body.error?.details,
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
        body: JSON.stringify({ refreshToken: state.refreshToken, deviceId: await getDeviceId() }),
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
  async startEmail(email: string) {
    const deviceId = await getDeviceId();
    const countryCode = useAppStore.getState().user.countryCode ?? undefined;
    return request<
      | { email: string; mode: "password" }
      | {
          email: string;
          mode: "verification";
          flowToken: string;
          verification?: { expiresInSeconds?: number; resendAvailableInSeconds?: number; sendsRemaining?: number };
        }
    >("/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email, deviceId, countryCode }),
    });
  },
  async verifyEmailCode(input: { email: string; code: string; flowToken: string }) {
    const deviceId = await getDeviceId();
    return request<{ email: string; setupToken: string }>("/auth/email/verify-code", {
      method: "POST",
      body: JSON.stringify({ ...input, deviceId }),
    });
  },
  async setPassword(input: { email: string; password: string; setupToken: string }) {
    const deviceId = await getDeviceId();
    return request<AuthResult>("/auth/email/set-password", {
      method: "POST",
      body: JSON.stringify({ ...input, deviceId }),
    });
  },
  async register(input: { name: string; email: string; password: string }) {
    const deviceId = await getDeviceId();
    const countryCode = useAppStore.getState().user.countryCode ?? undefined;
    return request<{
      userId: string;
      email: string;
      registrationToken: string;
      verification?: { expiresAt?: string };
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...input, deviceId, countryCode }),
    });
  },
  async login(input: { email: string; password: string }) {
    const deviceId = await getDeviceId();
    return request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...input, deviceId }),
    });
  },
  async refresh(refreshToken: string) {
    const deviceId = await getDeviceId();
    return request<AuthResult>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken, deviceId }),
    });
  },
  async verifyEmail(input: {
    email: string;
    code: string;
    registrationToken: string;
  }) {
    const deviceId = await getDeviceId();
    return request<AuthResult>("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ ...input, deviceId }),
    });
  },
  async resendCode(email: string) {
    const deviceId = await getDeviceId();
    return request<{ email: string; verification?: { expiresInSeconds?: number; resendAvailableInSeconds?: number; sendsRemaining?: number } }>("/auth/email/resend", {
      method: "POST",
      body: JSON.stringify({ email, deviceId }),
    });
  },
  async google(idToken: string) {
    const deviceId = await getDeviceId();
    const countryCode = useAppStore.getState().user.countryCode ?? undefined;
    return request<AuthResult>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken, deviceId, countryCode }),
    });
  },
  async telegramStart() {
    const deviceId = await getDeviceId();
    return request<{
      flowId: string;
      pollToken: string;
      botUrl: string;
      expiresInSeconds: number;
    }>("/auth/telegram/start", { method: "POST", body: JSON.stringify({ deviceId }) });
  },
  async telegramStatus(input: { flowId: string; pollToken: string }) {
    const deviceId = await getDeviceId();
    return request<
      | { status: "pending" }
      | ({ status: "complete" } & AuthResult)
    >("/auth/telegram/status", {
      method: "POST",
      body: JSON.stringify({ ...input, deviceId }),
    });
  },
  async telegramComplete(resumeToken: string) {
    const deviceId = await getDeviceId();
    return request<AuthResult>("/auth/telegram/complete", {
      method: "POST",
      body: JSON.stringify({ resumeToken, deviceId }),
    });
  },
  async telegramMiniApp(initData: string) {
    const deviceId = await getDeviceId();
    return request<AuthResult>("/auth/telegram/mini-app", {
      method: "POST",
      body: JSON.stringify({ initData, deviceId }),
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

export const gamesApi = {
  async list(token: string) {
    const payload = await request<{ games: GameCatalogItem[] }>("/games", {
      token,
    });
    return payload.games;
  },
};

export type ChallengeCompleteResult = {
  attempt: {
    id: string;
    gameKey: string;
    dayKey?: string;
    mode?: "challenge" | "practice";
    score: number;
    coinsAwarded: number;
    completedAt: string | null;
  };
  coins?: CoinWallet;
};

export type ChallengeStartResult = {
  attemptId: string;
  dayKey: string;
  gameKey: string;
  status: string;
  resumed: boolean;
};

export const challengesApi = {
  async today(token: string) {
    const payload = await request<{ today: TodayChallenges }>(
      "/challenges/today",
      { token },
    );
    return payload.today;
  },
  start(gameKey: string, token: string) {
    return request<ChallengeStartResult>(`/challenges/${encodeURIComponent(gameKey)}/start`, {
      method: "POST",
      token,
    });
  },
  complete(
    gameKey: string,
    input: { score: number; durationMs?: number },
    token: string,
  ) {
    return request<ChallengeCompleteResult>(
      `/challenges/${encodeURIComponent(gameKey)}/complete`,
      {
        method: "POST",
        token,
        body: JSON.stringify(input),
      },
    );
  },
  completePractice(
    gameKey: string,
    input: { score: number; durationMs?: number },
    token: string,
  ) {
    return request<ChallengeCompleteResult>(
      `/challenges/practice/${encodeURIComponent(gameKey)}/complete`,
      {
        method: "POST",
        token,
        body: JSON.stringify(input),
      },
    );
  },
  double(
    scope: "game" | "day",
    token: string,
    ad?: { provider: "yandex" | "appodeal" | "demo"; receiptId: string },
  ) {
    return request<{
      scope: "game" | "day";
      credited: number;
      coins: CoinWallet;
    }>("/challenges/double", {
      method: "POST",
      token,
      body: JSON.stringify({
        scope,
        ad,
      }),
    });
  },
  async pendingReward(token: string) {
    const payload = await request<{ reward: PendingContestReward | null }>(
      "/challenges/rewards/pending",
      { token },
    );
    return payload.reward;
  },
  claimReward(resultId: string, token: string) {
    return request<{
      result: ContestRewardResult;
      wallet: Wallet | null;
      coins: CoinWallet | null;
    }>(`/challenges/rewards/${encodeURIComponent(resultId)}/claim`, {
      method: "POST",
      token,
    });
  },
};

export type RewardedAdSessionDto = {
  sessionId: string;
  provider: "yandex" | "appodeal";
  placement: string;
  status: "started" | "completed" | "claimed" | "expired";
  rewardCoins: number;
  expiresAt: string;
};

export const adsApi = {
  async startRewarded(placement: string, token: string) {
    const payload = await request<{ session: RewardedAdSessionDto }>(
      "/ads/rewarded/start",
      {
        method: "POST",
        token,
        body: JSON.stringify({ placement, provider: "yandex" }),
      },
    );
    return payload.session;
  },
  async completeRewarded(sessionId: string, clientReceiptId: string, token: string) {
    const payload = await request<{ session: RewardedAdSessionDto }>(
      `/ads/rewarded/${encodeURIComponent(sessionId)}/complete`,
      {
        method: "POST",
        token,
        body: JSON.stringify({ clientReceiptId }),
      },
    );
    return payload.session;
  },
  async status(sessionId: string, token: string) {
    const payload = await request<{ session: RewardedAdSessionDto }>(
      `/ads/rewarded/${encodeURIComponent(sessionId)}`,
      { token },
    );
    return payload.session;
  },
  claim(sessionId: string, token: string) {
    return request<{
      sessionId: string;
      credited: number;
      idempotentReplay: boolean;
      coins: CoinWallet;
    }>(`/ads/rewarded/${encodeURIComponent(sessionId)}/claim`, {
      method: "POST",
      token,
    });
  },
  replay(sessionId: string, gameKey: string, token: string) {
    return request<{ effect: { gameKey: string; replayCount: number } }>(
      `/ads/rewarded/${encodeURIComponent(sessionId)}/replay`,
      { method: "POST", token, body: JSON.stringify({ gameKey }) },
    );
  },
};

export const giftsApi = {
  async list(token: string) {
    const payload = await request<{ gifts: GiftItem[] }>("/gifts", { token });
    return payload.gifts;
  },
  use(giftId: string, token: string, gameKey?: string) {
    return request<{ gift: GiftItem; effect: GiftUseEffect }>(
      `/gifts/${encodeURIComponent(giftId)}/use`,
      {
        method: "POST",
        token,
        body: JSON.stringify(gameKey ? { gameKey } : {}),
      },
    );
  },
};

export const leaderboardApi = {
  async get(metric: LeaderboardMetric, token: string): Promise<LeaderboardPayload> {
    const payload = await request<{
      metric: string;
      entries: {
        rank: number;
        userId: string;
        name: string;
        avatarUrl: string | null;
        countryCode: string | null;
        walletBalanceUnits: number;
        coinBalance: number;
        lifetimeEarnedUnits: number;
      }[];
      self: {
        rank: number;
        userId: string;
        name: string;
        avatarUrl: string | null;
        countryCode: string | null;
        walletBalanceUnits: number;
        coinBalance: number;
        lifetimeEarnedUnits: number;
      } | null;
    }>(
      `/leaderboard?metric=${encodeURIComponent(metric)}&limit=50`,
      { token },
    );
    const valueOf = (entry: { walletBalanceUnits: number; coinBalance: number }) =>
      metric === "coins" ? entry.coinBalance : entry.walletBalanceUnits;
    const entries: LeaderboardPayload["entries"] = payload.entries.map((entry) => ({
      rank: entry.rank,
      userId: entry.userId,
      name: entry.name,
      avatarUrl: entry.avatarUrl,
      countryCode: entry.countryCode,
      value: valueOf(entry),
      walletBalanceUnits: entry.walletBalanceUnits,
      coinBalance: entry.coinBalance,
      isCurrentUser: entry.userId === payload.self?.userId,
    }));
    const me: LeaderboardPayload["me"] = payload.self
      ? {
          rank: payload.self.rank,
          userId: payload.self.userId,
          name: payload.self.name,
          avatarUrl: payload.self.avatarUrl,
          countryCode: payload.self.countryCode,
          value: valueOf(payload.self),
          walletBalanceUnits: payload.self.walletBalanceUnits,
          coinBalance: payload.self.coinBalance,
          isCurrentUser: true,
        }
      : null;
    const entriesWithSelf = me && !entries.some((entry) => entry.userId === me.userId)
      ? [...entries, me]
      : entries;
    return {
      metric,
      entries: entriesWithSelf,
      me,
    };
  },
};

export type AdminGame = GameCatalogItem & {
  titleI18n?: Record<Language, string>;
  descriptionI18n?: Record<Language, string>;
  enabled?: boolean;
  sortOrder?: number;
  scoring?: { higherIsBetter?: boolean; maxCoins?: number };
};

export type AdminGameInput = {
  key: string;
  slug: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
  icon: string;
  color: string;
  engine: "native" | "webview";
  clientPath?: string;
  assetPath?: string;
  enabled?: boolean;
  challengeEnabled?: boolean;
  practiceEnabled?: boolean;
  sortOrder?: number;
  difficulty?: "easy" | "medium" | "hard";
  scoring?: { higherIsBetter?: boolean; maxCoins?: number };
};

export type AdminChallengeStatus = "draft" | "published" | "settled";
export type AdminChallengeSelectionMode = "manual" | "random";

export type AdminChallenge = {
  id: string;
  dayKey: string;
  timezone: string;
  status: AdminChallengeStatus;
  selectionMode: AdminChallengeSelectionMode;
  games: AdminGame[];
  cashPrizeMinUnits: number;
  cashPrizeMaxUnits: number;
  prizePoolUnits: number;
  coinPrizeAmounts: number[];
  maxAttemptsPerGame: number;
  oneSecondAttemptLimit: number;
  publishedAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminSettlement = {
  status: string;
  participantCount: number;
  cashWinnersCount: number;
  giftWinnersCount: number;
  coinWinnersCount: number;
  cashDistributedUnits: number;
  settledAt: string | null;
};

export type AdminOverview = {
  dayKey: string;
  timezone: string;
  registrations: number;
  registrationGrowthPercent: number | null;
  totalUsers: number;
  activePlayers: number;
  challengeParticipants: number;
  completedAttempts: number;
  coinsIssued: number;
  moneyIssuedUnits: number;
  challenge: AdminChallenge | null;
  settlement: AdminSettlement | null;
  trends?: AdminOverviewTrendPoint[];
};

export type AdminOverviewTrendPoint = {
  dayKey: string;
  registrations: number;
  activePlayers: number;
  challengeParticipants: number;
  coinsIssued: number;
};

export type AdminBudgetDay = {
  dayKey: string;
  adRevenueUnits: number;
  otherRevenueUnits: number;
  operatingExpenseUnits: number;
  manualCreditUnits: number;
  manualDebitUnits: number;
  revenueUnits: number;
  challengeSpendUnits: number;
  netUnits: number;
};

export type AdminBudget = {
  range: {
    from: string;
    to: string;
    days: number;
  };
  summary: {
    adRevenueUnits: number;
    otherRevenueUnits: number;
    totalRevenueUnits: number;
    operatingExpenseUnits: number;
    challengeSpendUnits: number;
    netUnits: number;
    arpuUnits: number;
    averageDailyRevenueUnits: number;
    growthPercent: number | null;
    activeUsers: number;
    platformBalanceUnits: number;
  };
  daily: AdminBudgetDay[];
};

export type AdminBlockedDevice = {
  id: string;
  deviceId: string;
  reason: "registration_limit" | "manual";
  bannedAt: string | null;
  lastSeenAt: string;
  accountCount: number;
  registrationCount: number;
  users: { id: string; name: string; email: string }[];
};

export const adminApi = {
  async games(token: string) {
    const payload = await request<{ games: AdminGame[] }>("/admin/games", {
      token,
    });
    return payload.games;
  },
  createGame(input: AdminGameInput, token: string) {
    return request<{ game: AdminGame }>("/admin/games", {
      method: "POST",
      token,
      body: JSON.stringify(input),
    });
  },
  updateGame(gameKey: string, input: Partial<Omit<AdminGameInput, "key">>, token: string) {
    return request<{ game: AdminGame }>(
      `/admin/games/${encodeURIComponent(gameKey)}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify(input),
      },
    );
  },
  challenge(dayKey: string, token: string) {
    return request<{ challenge: AdminChallenge | null }>(
      `/admin/daily-challenges/${encodeURIComponent(dayKey)}`,
      { token },
    );
  },
  challenges(range: { from: string; to: string }, token: string) {
    const search = new URLSearchParams(range);
    return request<{ challenges: AdminChallenge[] }>(
      `/admin/daily-challenges?${search.toString()}`,
      { token },
    );
  },
  saveChallenge(input: { dayKey: string; selectionMode: AdminChallengeSelectionMode; gameKeys?: string[]; cashPrizeMinUnits: number; cashPrizeMaxUnits: number; prizePoolUnits: number; coinPrizeAmounts: number[]; maxAttemptsPerGame: number; oneSecondAttemptLimit: number; publish: boolean }, token: string) {
    const { dayKey, ...body } = input;
    return request<{ challenge: AdminChallenge; notificationEvent: null | { id: string; status: string; targetCount: number } }>(`/admin/daily-challenges/${encodeURIComponent(dayKey)}`, {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    });
  },
  settle(dayKey: string, token: string) {
    return request<{ settlement: AdminSettlement; alreadySettled: boolean }>(`/admin/daily-challenges/${encodeURIComponent(dayKey)}/settle`, { method: "POST", token });
  },
  overview(dayKey: string, token: string) {
    return request<AdminOverview>(`/admin/overview?dayKey=${encodeURIComponent(dayKey)}`, {
      token,
    });
  },
  budget(days: number, token: string) {
    return request<AdminBudget>(`/admin/budget?days=${encodeURIComponent(String(days))}`, {
      token,
    });
  },
  adjustBudget(input: { direction: "credit" | "debit"; amountUnits: number; note: string }, token: string) {
    return request<{ entry: { id: string; amountUnits: number; type: "manual_credit" | "manual_debit" } }>("/admin/budget/adjustments", {
      method: "POST",
      token,
      body: JSON.stringify({
        ...input,
        idempotencyKey: `budget-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }),
    });
  },
  blockedDevices(token: string) {
    return request<{ devices: AdminBlockedDevice[] }>("/admin/blocked-devices", { token });
  },
  unbanDevice(deviceId: string, token: string) {
    return request<{ device: { deviceId: string; unbannedAt: string | null } }>(
      `/admin/blocked-devices/${encodeURIComponent(deviceId)}/unban`,
      { method: "POST", token },
    );
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

export type PublicProfile = {
  name: string;
  avatarUrl: string | null;
  countryCode: string | null;
  referralCode: string;
  balanceUnits: number;
  lifetimeEarnedUnits: number;
  coinBalance: number;
  lifetimeCoins: number;
  completedChallenges: number;
  skins: string[];
};

export const publicProfileApi = {
  get(code: string) {
    return request<{ profile: PublicProfile }>(`/profile/${encodeURIComponent(code)}`);
  },
};

export const withdrawalsApi = {
  overview(token: string) {
    return request<WithdrawalOverview>("/withdrawals", { token });
  },
  create(
    input: {
      amountCents: number;
      card: {
        brand: "visa" | "mastercard" | "other";
        last4: string;
        holderName: string;
        expiration: string;
      };
      agreementAccepted: true;
    },
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
        method: "bank_card",
        card: input.card,
        agreementAccepted: input.agreementAccepted,
        agreementVersion: "2026-08-23",
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
      avatarDataUrl?: string | null;
      savingsGoalCents?: number;
      countryCode?: string;
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

export const devicesApi = {
  updatePreferences(
    deviceId: string,
    input: {
      platform: "android" | "ios" | "web";
      pushToken: string | null;
      notificationsEnabled: boolean;
      dailyReminderEnabled: boolean;
      reminderTime: string;
      timezone: string;
    },
    token: string,
  ) {
    return request<{
      device: {
        id: string;
        deviceId: string;
        platform: "android" | "ios" | "web";
        pushConfigured: boolean;
        notificationsEnabled: boolean;
        dailyReminderEnabled: boolean;
        reminderTime: string;
        timezone: string;
      };
    }>(`/devices/${encodeURIComponent(deviceId)}/preferences`, {
      method: "PUT",
      token,
      body: JSON.stringify(input),
    });
  },
};

export const gameProgressApi = {
  get(token: string) {
    return request<{ games: GamesProgress }>("/games/progress", { token });
  },
  put(games: GamesProgress, token: string) {
    return request<{ games: GamesProgress }>("/games/progress", {
      method: "PUT",
      token,
      body: JSON.stringify({ games }),
    });
  },
  convert(input: { gameId: GameId; coins: number; idempotencyKey: string }, token: string) {
    return request<{
      convertedUnits: number;
      games: GamesProgress;
      wallet: Wallet;
      idempotentReplay: boolean;
    }>("/games/convert", {
      method: "POST",
      token,
      body: JSON.stringify(input),
    });
  },
};

export { API_URL };
