import type { ThemeMode } from "@/constants/theme";

export type Language = "ru" | "uz" | "en";
export type AuthMode = "guest" | "authenticated" | null;

export type Wallet = {
  availableUnits: number;
  availableCents: number;
  lockedUnits: number;
  lockedCents: number;
  lifetimeEarnedUnits?: number;
  lifetimeEarnedCents?: number;
  referralEarnedUnits?: number;
  referralEarnedCents?: number;
  unitValueCents?: number;
  currency?: string;
};

export type CoinWallet = {
  balance: number;
  lifetimeEarned: number;
  referralEarned: number;
};

export type UserPreferences = {
  language: Language;
  theme: ThemeMode;
  savingsGoalCents: number;
  notificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  timezone: string;
};

export type User = {
  id?: string;
  role?: "user" | "admin";
  name: string;
  email?: string;
  avatarUrl?: string | null;
  referralCode?: string;
  emailVerified?: boolean;
  preferences?: UserPreferences;
  wallet?: Partial<Wallet>;
  coins?: Partial<CoinWallet>;
};

export type GraceStreak = {
  activeDays: number;
  calendarSpanDays: number;
  graceDaysUsed: number;
  lastActiveDay: string | null;
};

export type ActivityDay = {
  dayKey: string;
  actionCount: number;
  rewardUnits: number;
};

export type ActivityOverview = {
  from?: string;
  to?: string;
  timezone?: string;
  totalActiveDays: number;
  streak: GraceStreak;
  days: ActivityDay[];
};

export type BonusKind = "daily" | "weekly" | "monthly";

export type BonusTier = {
  key: string;
  rewardUnits: number;
  claimed: boolean;
  available: boolean;
  activeDays?: number;
  requiredActiveDays?: number;
  period?: { from: string; to: string };
};

export type BonusOverview = {
  timezone: string;
  today: string;
  streak: GraceStreak;
  daily: BonusTier;
  weekly: BonusTier;
  monthly: BonusTier;
};

export type ReferralOverview = {
  code: string;
  link: string;
  invitedCount: number;
  verifiedInvitedCount: number;
  earnedUnits: number;
  earnedCents: number;
  earnedCoins?: number;
  signupRewardUnits: number;
  friends: {
    id: string;
    name: string;
    avatarUrl: string | null;
    verified: boolean;
    joinedAt: string;
  }[];
  history: {
    id: string;
    amountUnits: number;
    amountCents: number;
    createdAt: string;
  }[];
  coinHistory?: {
    id: string;
    amount: number;
    createdAt: string;
  }[];
};

export type Withdrawal = {
  id: string;
  amountCents: number;
  amountUnits: number;
  method: "sandbox";
  accountLabel?: string | null;
  status: string;
  requestedAt: string;
  processedAt?: string | null;
  idempotentReplay?: boolean;
};

export type WithdrawalOverview = {
  sandbox: true;
  minimumCents: number;
  eligible: boolean;
  wallet: Wallet;
  withdrawals: Withdrawal[];
};

export type GameDifficulty = "easy" | "medium" | "hard";

export type GameCatalogItem = {
  id: string;
  key: string;
  slug: string;
  icon: string;
  color: string;
  engine: "native" | "webview";
  difficulty: GameDifficulty;
  title: string;
  description: string;
  challengeEnabled: boolean;
  practiceEnabled: boolean;
};

export type ChallengeGameState = {
  status: "not_started" | "started" | "completed";
  score: number | null;
  coinsAwarded: number;
  doubled: boolean;
  completedAt: string | null;
};

export type TodayChallengeGame = GameCatalogItem & {
  attemptLimit?: number;
  state: ChallengeGameState;
};

export type ChallengeDoublingInfo = {
  firstGameKey: string | null;
  gameDoubled: boolean;
  dayDoubled: boolean;
  dayEligible: boolean;
};

export type DailyPrizeConfig = {
  cashMinUnits: number;
  cashMaxUnits: number;
  poolUnits: number;
};

export type TodayChallenges = {
  status: "published" | "no_challenge";
  available: boolean;
  dayKey: string;
  nextChallengeAt: string | null;
  totalCount: number;
  completedCount: number;
  gamesCompletedToday?: number;
  totalCoinsToday: number;
  monthlyChallengeCount?: number;
  games: TodayChallengeGame[];
  coins: CoinWallet;
  doubling?: ChallengeDoublingInfo;
  prizes: DailyPrizeConfig | null;
};

export type GiftItem = {
  id: string;
  kind: "time_extension" | "extra_time" | "replay" | "coin";
  amountSeconds: number | null;
  replayCount: number | null;
  coinAmount: number | null;
  status: "available" | "used";
  description: string;
  usedAt: string | null;
  usedOnGameKey: string | null;
  createdAt: string;
};

export type GiftUseEffect =
  | { kind: "time_extension"; additionalTimeSeconds: number }
  | { kind: "replay"; replayCount: number; gameKey: string }
  | { kind: "coin"; coinsCredited: number };

export type LeaderboardMetric = "wallet" | "coins" | "lifetime";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  value: number;
  isCurrentUser?: boolean;
};

export type LeaderboardPayload = {
  metric: LeaderboardMetric;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
};

export type BootstrapPayload = {
  user: User & { preferences: UserPreferences; wallet: Wallet };
  tasks: unknown[];
  todayChallenges?: TodayChallenges;
  bonuses: BonusOverview;
  activity: {
    totalActiveDays: number;
    streak: GraceStreak;
  };
  referral: ReferralOverview;
  economy: {
    currency: string;
    unitValueCents: number;
    minimumWithdrawalCents: number;
    withdrawalsAreSandbox: boolean;
    taskProvider: string;
  };
  supported: {
    languages: Language[];
  };
};

export type TaskCategory =
  | "daily"
  | "quick"
  | "boost"
  | "social"
  | "streak";

export type LogicTask = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  rewardUnits: number;
  category: TaskCategory;
  icon: "play" | "layers" | "sparkles" | "calendar" | "people";
  color: string;
  repeatable?: boolean;
  available?: boolean;
  remainingToday?: number;
  cooldownRemainingSeconds?: number;
};
