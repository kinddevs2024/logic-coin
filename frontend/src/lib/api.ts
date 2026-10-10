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
  LeaderboardPage,
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
import type { ThemePreference } from "@/constants/theme";
import { registrationReferralCode } from "./referral-attribution";
import type { GameId, GamesProgress } from "@/games/progress-store";
import { useAppStore } from "@/store/app-store";
import { Platform } from "react-native";
import { getDeviceId } from "@/lib/device-id";

const defaultApiUrl =
  Platform.OS === "web"
    ? process.env.NODE_ENV === "development"
      ? "http://localhost:4000/api/v1"
      : "/api/v1"
    : process.env.NODE_ENV === "production"
      ? "https://logic-coin.online/api/v1"
      : Platform.OS === "android"
        ? "http://10.0.2.2:4000/api/v1"
        : "http://localhost:4000/api/v1";

// Web production must always use the same origin. A developer's local Expo
// environment is inlined at export time, so using EXPO_PUBLIC_API_URL here
// would otherwise publish localhost as the API host for every site visitor.
const configuredApiUrl = Platform.OS === "web" && process.env.NODE_ENV !== "development"
  ? defaultApiUrl
  : process.env.EXPO_PUBLIC_API_URL || defaultApiUrl;

const API_URL = configuredApiUrl.replace(
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

export async function refreshAccessToken(expiredToken: string): Promise<string> {
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
    const referralCode = await registrationReferralCode();
    const deviceId = await getDeviceId();
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
      body: JSON.stringify({ email, deviceId, ...(referralCode ? { referralCode } : {}) }),
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
    const referralCode = await registrationReferralCode();
    const deviceId = await getDeviceId();
    return request<{
      userId: string;
      email: string;
      registrationToken: string;
      verification?: { expiresAt?: string };
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...input, deviceId, ...(referralCode ? { referralCode } : {}) }),
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
    const referralCode = await registrationReferralCode();
    const deviceId = await getDeviceId();
    return request<AuthResult>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken, deviceId, ...(referralCode ? { referralCode } : {}) }),
    });
  },
  async telegramStart() {
    const referralCode = await registrationReferralCode();
    const deviceId = await getDeviceId();
    return request<{
      flowId: string;
      pollToken: string;
      botUrl: string;
      expiresInSeconds: number;
    }>("/auth/telegram/start", { method: "POST", body: JSON.stringify({ deviceId, ...(referralCode ? { referralCode } : {}) }) });
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
    const referralCode = await registrationReferralCode();
    const deviceId = await getDeviceId();
    return request<AuthResult>("/auth/telegram/mini-app", {
      method: "POST",
      body: JSON.stringify({ initData, deviceId, ...(referralCode ? { referralCode } : {}) }),
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
  rules(token: string, day?: string) {
    return request<{
      dayKey: string; source: "automatic" | "manual" | "saved"; final: boolean;
      poolUnits: number; participantCount: number; cashWinnerCount: number; otherMaxCashUnits: number;
      podium: { rank: number; cashUnits: number | null }[];
    }>(`/challenges/rules${day ? `?day=${encodeURIComponent(day)}` : ""}`, { token });
  },
  history(token: string, day?: string, offset = 0) {
    return request<{
      today: string; dayKey: string; days: string[]; status: "final" | "live" | "pending" | "missing";
      dayStatuses?: Record<string, "final" | "live" | "pending" | "missing">;
      self?: { userId: string; rank: number; totalCoins: number; completedGamesCount: number } | null;
      total: number; nextOffset: number | null;
      rows: { userId: string; rank: number; totalCoins: number; completedGamesCount: number; name: string; avatarUrl: string | null; isSelf: boolean }[];
    }>(`/challenges/history?offset=${offset}${day ? `&day=${encodeURIComponent(day)}` : ""}`, { token });
  },
  progress(token: string, cursor?: { snapshot: string; offset: number; end?: number }) {
    return request<{
      dayKey: string; participantCount: number; projectedCashUnits: number;
      previous: { snapshot: string; offset: number; end?: number } | null;
      next: { snapshot: string; offset: number; end?: number } | null;
      self: { rank: number; totalCoins: number; completedGamesCount: number } | null;
      neighbors: { userId: string; rank: number; totalCoins: number; name: string; avatarUrl: string | null; isSelf: boolean }[];
    }>(`/challenges/progress${cursor ? `?snapshot=${encodeURIComponent(cursor.snapshot)}&offset=${cursor.offset}${cursor.end !== undefined ? `&end=${cursor.end}` : ""}` : ""}`, { token });
  },

  async today(token: string, signal?: AbortSignal) {
    const payload = await request<{ today: TodayChallenges }>(
      "/challenges/today",
      { token, signal },
    );
    return payload.today;
  },
  start(gameKey: string, token: string) {
    return import("./challenge-live-updates").then(({ liveCommand }) => liveCommand<ChallengeStartResult>(token, "start", { gameKey }));
  },
  complete(
    gameKey: string,
    input: { score: number; durationMs?: number },
    token: string,
  ) {
    return import("./challenge-live-updates").then(({ liveCommand }) => liveCommand<ChallengeCompleteResult>(token, "complete", { gameKey, ...input }));
  },
  completePractice(
    gameKey: string,
    input: { score: number; durationMs?: number },
    token: string,
  ) {
    return import("./challenge-live-updates").then(({ liveCommand }) => liveCommand<ChallengeCompleteResult>(token, "completePractice", { gameKey, ...input }));
  },
  double(
    scope: "game" | "day",
    token: string,
    ad?: { provider: "yandex" | "appodeal" | "demo"; receiptId: string },
  ) {
    return import("./challenge-live-updates").then(({ liveCommand }) => liveCommand<{
      scope: "game" | "day";
      credited: number;
      coins: CoinWallet;
    }>(token, "double", { scope, ad }));
  },
  async pendingReward(token: string) {
    const { liveCommand } = await import("./challenge-live-updates");
    return liveCommand<PendingContestReward | null>(token, "pendingReward");
  },
  claimReward(resultId: string, token: string) {
    return import("./challenge-live-updates").then(({ liveCommand }) => liveCommand<{
      result: ContestRewardResult;
      wallet: Wallet | null;
      coins: CoinWallet | null;
    }>(token, "claimReward", { resultId }));
  },
};

export type RewardedAdSessionDto = {
  sessionId: string;
  provider: "yandex" | "appodeal";
  placement: string;
  status: "started" | "completed" | "claimed" | "expired";
  rewardCoins: number;
  rewardLabel?: string;
  expiresAt: string;
};

export const adsApi = {
  challengeOffer(token: string) {
    return request<{ eligible: boolean; available: boolean; challengeSetId: string | null; dayKey: string | null; rewardDayKey?: string; rewardCoins: number; cooldownSeconds: number; availableAt: string; serverNow: string }>("/ads/rewarded/offer", { token });
  },
  async startRewarded(placement: string, token: string, gameAttemptId?: string) {
    const payload = await request<{ session: RewardedAdSessionDto }>(
      "/ads/rewarded/start",
      {
        method: "POST",
        token,
        body: JSON.stringify({ placement, provider: "yandex", ...(gameAttemptId ? { gameAttemptId } : {}) }),
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

export type CoinRewardOffer = {
  dayKey: string;
  daily: { day: number; dayKey: string; coins: number; status: "claimed" | "available" | "missed" | "locked" }[];
  weekly: CoinPeriodReward;
  monthly: CoinPeriodReward;
};
export type CoinPeriodReward = { kind: "week" | "month"; from: string; to: string; coins: number; activeDays: number; totalDays: number; status: "claimed" | "available" | "locked" };
export const giftsApi = {
  coinRewards(token: string) { return request<CoinRewardOffer>("/gifts/coin-rewards", { token }); },
  claimCoinReward(kind: "daily" | "week" | "month", token: string) { return request<{ credited: number; coins: CoinWallet }>("/gifts/coin-rewards/claim", { method: "POST", token, body: JSON.stringify({ kind }) }); },
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
  async getPage(offset: number, limit: number, token: string, signal?: AbortSignal): Promise<LeaderboardPage> {
    const payload = await request<{
      total: number;
      offset: number;
      limit: number;
      leaderboards: Record<LeaderboardMetric, {
        metric: LeaderboardMetric;
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
      }>;
    }>(
      `/leaderboard?metric=all&limit=${limit}&offset=${offset}`,
      { token, signal },
    );
    const leaderboards = Object.fromEntries(
      (Object.keys(payload.leaderboards) as LeaderboardMetric[]).map((metric) => {
        const source = payload.leaderboards[metric];
        const valueOf = (entry: { walletBalanceUnits: number; coinBalance: number }) =>
          metric === "coins" ? entry.coinBalance : entry.walletBalanceUnits;
        const mapEntry = (entry: (typeof source.entries)[number]) => ({
          rank: entry.rank,
          userId: entry.userId,
          name: entry.name,
          avatarUrl: entry.avatarUrl,
          countryCode: entry.countryCode,
          value: valueOf(entry),
          walletBalanceUnits: entry.walletBalanceUnits,
          coinBalance: entry.coinBalance,
          isCurrentUser: entry.userId === source.self?.userId,
        });
        return [metric, {
          metric,
          entries: source.entries.map(mapEntry),
          me: source.self ? { ...mapEntry(source.self), isCurrentUser: true } : null,
        } satisfies LeaderboardPayload];
      }),
    ) as LeaderboardPage["leaderboards"];
    return {
      total: payload.total,
      offset: payload.offset,
      limit: payload.limit,
      leaderboards,
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

export type AdminPrizePlan = {
  dayKey: string; mode: "automatic" | "manual"; revision: number; locked: boolean;
  prizePoolUnits: number; allocatedUnits: number; remainingUnits: number;
  participants: { userId: string; name: string; rank: number; totalCoins: number; cashUnits: number }[];
};

export type AdminWithdrawal = {
  id: string; user: { id: string; name: string; email: string | null; referralCode: string | null };
  amountCents: number; status: string; method: string; accountLabel: string | null; cardHolder: string | null;
  requestedAt: string; processedAt: string | null; reviewVersion: number; reviewNote: string | null;
  paymentReference: string | null; reviewedAt: string | null;
  reviewHistory: { action: string; adminId: string; at: string; note: string | null; paymentReference: string | null }[];
};
export type AdminWithdrawalPage = { withdrawals: AdminWithdrawal[]; nextCursor: string | null; summary: { status: string; count: number; amountCents: number }[] };

export const adminApi = {
 users(q:string,page:number,token:string){return request<{users:any[];total:number}>(`/admin/users?q=${encodeURIComponent(q)}&page=${page}`,{token});},
 editUser(id:string,input:any,token:string){return request<{user:any}>(`/admin/users/${encodeURIComponent(id)}`,{method:"PATCH",token,body:JSON.stringify(input)});},
 resetBalances(input:{kind:"money"|"coins";confirmation:string;reason:string;operationId:string},token:string){return request<{count:number}>("/admin/users/reset-balances",{method:"POST",token,body:JSON.stringify(input)});},
  withdrawals(input: { status?: string; before?: string }, token: string) {
    const params = new URLSearchParams({ limit: "20", ...(input.status ? { status: input.status } : {}), ...(input.before ? { before: input.before } : {}) });
    return request<AdminWithdrawalPage>(`/admin/withdrawals?${params}`, { token });
  },
  reviewWithdrawal(id: string, input: { action: "approve" | "reject" | "mark_paid"; expectedVersion: number; note?: string; paymentReference?: string; paymentConfirmed?: boolean }, token: string) {
    return request<{ id: string; status: string }>(`/admin/withdrawals/${encodeURIComponent(id)}/review`, { method: "POST", token, body: JSON.stringify(input) });
  },
  challengePrizes(dayKey: string, token: string) {
    return request<AdminPrizePlan>(`/admin/daily-challenges/${encodeURIComponent(dayKey)}/prizes`, { token });
  },
  saveChallengePrizes(dayKey: string, input: { mode: "automatic" | "manual"; revision: number; prizes: { userId: string; cashUnits: number }[] }, token: string) {
    return request<AdminPrizePlan>(`/admin/daily-challenges/${encodeURIComponent(dayKey)}/prizes`, { method: "PUT", token, body: JSON.stringify(input) });
  },
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
  archiveGame(gameKey: string, token: string) {
    return request<{ game: AdminGame }>(`/admin/games/${encodeURIComponent(gameKey)}`, { method: "DELETE", token });
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
  sendNotification(input: { title: string; body: string; userName?: string }, token: string) {
    return request<{
      notification: {
        id: string;
        audience: "all_users" | "user_name";
        recipientName: string | null;
        status: string;
        targetCount: number;
        sentCount: number;
        failedCount: number;
      };
    }>("/admin/notifications", {
      method: "POST",
      token,
      body: JSON.stringify(input),
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
  resetDevice(deviceId: string, token: string) {
    return request<{ device: { deviceId: string; accountLimit: number } }>(
      `/admin/blocked-devices/${encodeURIComponent(deviceId)}/reset`,
      { method: "POST", token },
    );
  },
};

export type InboxNotification = { id: string; title: string; body: string; createdAt: string; read: boolean; kind: string };
export type HomeGiftOffer = { kind: "telegram" | "ads"; rewardCoins: number; eligible: boolean; available: boolean; availableAt: string; serverNow: string; telegramLinked: boolean; channelUrl: string; completedAds: number; exhausted?: boolean; dailyClaimCount?: number; dailyLimit?: number };
export type HomeGiftLink = { flowId: string; pollToken: string; botUrl: string };
export const homeGiftApi = {
  offer: (token: string) => request<HomeGiftOffer>("/home-gift", { token }),
  link: (token: string) => request<HomeGiftLink>("/home-gift/telegram/link", { token, method: "POST" }),
  finishLink: (token: string, flow: HomeGiftLink) => request<{ linked: boolean }>("/home-gift/telegram/finish-link", { token, method: "POST", body: JSON.stringify({ flowId: flow.flowId, pollToken: flow.pollToken }) }),
  claimTelegram: (token: string) => request<{ credited: number; alreadyClaimed: boolean }>("/home-gift/telegram/claim", { token, method: "POST" }),
  startAds: (token: string) => request<{ cycleId: string; completedAds: number }>("/home-gift/ads/start", { token, method: "POST" }),
  claimAds: (token: string, cycleId: string) => request<{ credited: number; alreadyClaimed: boolean }>("/home-gift/ads/claim", { token, method: "POST", body: JSON.stringify({ cycleId }) }),
};
export const inboxApi = {
  unreadCount(token: string) {
    return request<{ count: number }>("/notifications/unread-count", { token });
  },
  list(token: string, all: boolean, cursor: { date: string; id: string } | null) {
    const query = new URLSearchParams({ all: String(all), ...(cursor ?? {}) });
    return request<{ items: InboxNotification[]; next: { date: string; id: string } | null }>(`/notifications?${query}`, { token });
  },
  read(token: string, ids: string[]) {
    return request<{ marked: number }>("/notifications/read", { method: "POST", token, body: JSON.stringify({ ids }) });
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
      theme?: ThemePreference;
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
  pushConfig(token: string) {
    return request<{ publicKey: string | null }>("/devices/push-config", { token });
  },
  updatePreferences(
    deviceId: string,
    input: {
      platform: "android" | "ios" | "web";
      pushToken?: string | null;
      webPush?: { endpoint: string; keys: { p256dh: string; auth: string } } | null;
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
