import type { ThemeMode } from "@/constants/theme";

export type Language = "ru" | "uz" | "en";
export type PiggyKind = "pig" | "jar" | "safe" | "car" | "rocket";
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

export type UserPreferences = {
  language: Language;
  theme: ThemeMode;
  piggyBankVariant: PiggyKind;
  savingsGoalCents: number;
  notificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  timezone: string;
};

export type User = {
  id?: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  referralCode?: string;
  emailVerified?: boolean;
  preferences?: UserPreferences;
  wallet?: Partial<Wallet>;
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

export type BootstrapPayload = {
  user: User & { preferences: UserPreferences; wallet: Wallet };
  tasks: unknown[];
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
    piggyBankVariants: PiggyKind[];
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
