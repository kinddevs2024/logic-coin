import { USER_ROLES } from "../config/constants.js";
export type PlatformRole = (typeof USER_ROLES)[number];
export function canMessageEveryone(role: unknown) { return role === "manager" || role === "admin" || role === "owner"; }
export function canManagePlatform(role: unknown) { return role === "admin"; }
export function canViewReports(role: unknown) { return role === "owner" || role === "admin"; }
