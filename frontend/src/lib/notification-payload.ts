const objectId = /^[a-f\d]{24}$/i;
/** Android launch intents and foreground notifications wrap FCM data differently. */
export function notificationPayload(input: unknown): Record<string, unknown> {
  let data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  for (let i = 0; i < 3; i++) {
    const nested = data.body ?? data.dataString ?? data.data;
    let value: unknown = nested;
    if (typeof nested === "string" && nested.length < 20000) { try { value = JSON.parse(nested); } catch { break; } }
    if (!value || typeof value !== "object" || Array.isArray(value)) break;
    data = { ...data, ...value as Record<string, unknown> };
  }
  if (!(typeof data.conversationId === "string" && objectId.test(data.conversationId)) && typeof data.url === "string") {
    try { const url = new URL(data.url, "https://logic-coin.online"); const id = url.searchParams.get("chat"); if ((["logic-coin.online", "www.logic-coin.online", "logic-coin.173.212.216.216.sslip.io"].includes(url.hostname) && url.pathname === "/messages" || url.protocol === "logiccoin:" && (url.pathname === "/messages" || url.hostname === "messages")) && id && objectId.test(id)) data.conversationId = id; } catch { /* Ignore malformed notification routes. */ }
  }
  return data;
}
