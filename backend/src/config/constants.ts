export const API_PREFIX = "/api/v1";

export const SUPPORTED_LANGUAGES = ["en", "ru", "uz"] as const;
export const THEMES = ["light", "sky", "dark"] as const;
export const USER_ROLES = ["user", "admin"] as const;

export const DAILY_BONUS_REWARDS_UNITS = [2, 3, 4, 5, 7, 10, 15] as const;
export const WEEKLY_BONUS_REWARD_UNITS = 25;
export const MONTHLY_BONUS_REWARD_UNITS = 100;
export const WEEKLY_REQUIRED_ACTIVE_DAYS = 6;
export const MONTHLY_REQUIRED_ACTIVE_DAYS = 24;

export const DAILY_CHALLENGE_GAME_COUNT = 6;
export const MAX_GAME_COINS = 1_000;
export const MAX_CHALLENGE_SCORE = 1_000_000_000;
export const MAX_CHALLENGE_DURATION_MS = 3_600_000;
export const CONTEST_CASH_TOP_PERCENT = 0.1;
export const CONTEST_CASE_PERCENT = 0.45;
export const CONTEST_RANDOM_PERCENT = 0.35;
export const CONTEST_CONSOLATION_COINS = 500;
export const CONTEST_STANDARD_CASE_KIND = "standard";
export const DEFAULT_DAILY_PRIZE_MIN_UNITS = 500;
export const DEFAULT_DAILY_PRIZE_MAX_UNITS = 10_000;
export const DEFAULT_DAILY_PRIZE_POOL_UNITS = 100_000;
export const GIFT_TIME_EXTENSION_SECONDS = 15;
export const GIFT_REPLAY_COUNT = 1;
export const GIFT_COIN_AMOUNT = 500;
export const REFERRAL_PRIZE_SHARE_PERCENT = 25;
