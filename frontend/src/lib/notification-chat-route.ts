export type PendingChat = { id: string; account: string };
export function notificationChatRoute(pending: PendingChat | null, state: {
  ready: boolean; active: boolean; authenticated: boolean; account?: string; token?: string | null;
}) {
  if (!pending || !state.ready || !state.active || !state.authenticated || !state.token || pending.account !== state.account || !/^[a-f\d]{24}$/i.test(pending.id)) return null;
  return { pathname: "/(tabs)/messages" as const, params: { chat: pending.id, invite: "", messageSearch: "" } };
}
