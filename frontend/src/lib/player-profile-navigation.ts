export function playerProfileRoute(id: string, chat?: string, search?: string) {
  const params: { id: string; returnChat?: string; returnSearch?: string } = { id };
  if (chat && /^[a-f\d]{24}$/i.test(chat)) {
    params.returnChat = chat;
    if (search) params.returnSearch = search;
  }
  return { pathname: "/player/[id]" as const, params };
}

export function sourceChatRoute(chat: unknown, search: unknown) {
  if (typeof chat !== "string" || !/^[a-f\d]{24}$/i.test(chat)) return null;
  return { pathname: "/messages" as const, params: { chat, messageSearch: typeof search === "string" ? search : "" } };
}
