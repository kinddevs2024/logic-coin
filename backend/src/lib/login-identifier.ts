import { z } from "zod";
import { normalizeEmail } from "./crypto.js";
export const loginIdentifierSchema = z.union([
  z.string().trim().email().max(254).transform(normalizeEmail),
  z.string().trim().regex(/^@[A-Za-z][A-Za-z0-9_]{3,23}$/).transform(value => value.toLowerCase()),
]);
export function loginIdentityFilter(identifier: string) {
  return identifier.startsWith("@") ? { username: identifier.slice(1).toLowerCase() } : { email: normalizeEmail(identifier) };
}
