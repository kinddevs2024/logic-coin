import { request } from "./api";
export type ActivityPlayer = { id: string; name: string; avatarUrl: string | null; coins: number; balanceUnits: number };
export type HomeActivityPeriod = { from: string; endsAt: string; totalDays: number; completedDays: number; missedDays: number; allowedMisses: number; eligible: boolean; percent: number; participants: ActivityPlayer[] };
export type HomeActivity = { serverNow: string; dayKey: string; week: HomeActivityPeriod; month: HomeActivityPeriod };
export const getHomeActivity = (token: string) => request<HomeActivity>("/activity/home", { token });
