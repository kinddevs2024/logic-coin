import { dehydrate, hashKey, hydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";

const CORE = new Set(["bootstrap", "games", "challenges", "chat-list"]);
const TOKEN = "__current_account_token__";
const ALLOWED = new Set(["bootstrap", "games", "tasks", "challenges", "home", "home-content", "bonuses", "activity", "account-activity", "referrals", "account-wallet", "leaderboard", "chat-list", "chat-messages", "chat-profile", "chat-friend-requests", "inbox", "unread-count"]);

export function snapshotQueries(client: QueryClient, tokens: Set<string>) {
  return dehydrate(client, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: q => q.state.data !== undefined && q.state.dataUpdatedAt > 0 && ALLOWED.has(String(q.queryKey[0])),
  }).queries.sort((a, b) => Number(CORE.has(String(b.queryKey[0]))) - Number(CORE.has(String(a.queryKey[0]))) || b.state.dataUpdatedAt - a.state.dataUpdatedAt).map(q => ({
    queryKey: q.queryKey.map(part => typeof part === "string" && tokens.has(part) ? TOKEN : part),
    // A failed background refresh must not erase the last successful snapshot.
    state: { ...q.state, status: "success" as const, error: null, fetchFailureReason: null, fetchStatus: "idle" as const },
  })).filter(q => !JSON.stringify(q.queryKey).includes("eyJ"));
}

export function restoreQueries(client: QueryClient, entries: unknown[], token: string, now = Date.now()) {
  const queries: DehydratedState["queries"] = [];
  for (const raw of entries) {
    const q = raw as DehydratedState["queries"][number];
    if (!Array.isArray(q?.queryKey) || !ALLOWED.has(String(q.queryKey[0])) || q.state?.status !== "success" || !Number.isFinite(q.state.dataUpdatedAt)) continue;
    if (q.queryKey[0] === "challenges") {
      const endsAt = (q.state.data as { endsAt?: string })?.endsAt;
      // Use the server's expiry, not the phone's timezone or a guessed day boundary.
      if (!endsAt || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= now) continue;
    }
    const queryKey = q.queryKey.map(part => part === TOKEN ? token : part);
    // Even Infinity-staleTime queries must revalidate once after a cold launch.
    queries.push({ queryKey, queryHash: hashKey(queryKey), state: { ...q.state, isInvalidated: true, fetchStatus: "idle" } });
  }
  hydrate(client, { mutations: [], queries });
}
