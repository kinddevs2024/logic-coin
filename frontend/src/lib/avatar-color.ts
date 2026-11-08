// Keep order and values stable: the immutable account ID is the assignment seed.
// Mongo account IDs contain random bytes, so both existing and new accounts get
// a distributed color without a migration or per-device storage.
export const AVATAR_COLORS = [
  { background: "#EDF4FF", foreground: "#315B9D" },
  { background: "#EFF8F0", foreground: "#356345" },
  { background: "#FFFBE8", foreground: "#786020" },
  { background: "#FFF0F0", foreground: "#995050" },
] as const;

export function avatarColor(accountId: string) {
  let hash = 2166136261;
  for (let i = 0; i < accountId.length; i++) {
    hash = Math.imul(hash ^ accountId.charCodeAt(i), 16777619);
  }
  return AVATAR_COLORS[(hash >>> 0) % AVATAR_COLORS.length];
}
