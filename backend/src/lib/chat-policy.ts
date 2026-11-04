export function canPostChat(input: {
  kind: string;
  systemKey?: string | null | undefined;
  siteAdmin: boolean;
  memberRole?: string | null | undefined;
}) {
  if (input.systemKey === "news") return input.siteAdmin;
  if (input.kind === "channel")
    return (
      input.siteAdmin ||
      input.memberRole === "owner" ||
      input.memberRole === "admin"
    );
  return true;
}
export function normalizeUsername(value: string) {
  const name = value.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z][a-z0-9_]{3,23}$/.test(name) &&
    !["admin", "support", "logiccoin", "logic_coin", "telegram"].includes(name)
    ? name
    : null;
}
