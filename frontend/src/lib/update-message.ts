export type UpdateMessage = { id: string; kind: "downloaded" | "applied" };
export const updateMessageCopy = {
  ru: { downloaded: "Обновление скачано", applied: "Приложение обновлено" },
  uz: { downloaded: "Yangilanish yuklab olindi", applied: "Ilova yangilandi" },
  en: { downloaded: "Update downloaded", applied: "App updated" },
};

export function selectUpdateMessage(input: { enabled: boolean; pendingId?: string | null; runningId?: string | null; embedded: boolean }): UpdateMessage | null {
  if (!input.enabled) return null;
  if (input.pendingId) return { id: input.pendingId, kind: "downloaded" };
  if (!input.embedded && input.runningId) return { id: input.runningId, kind: "applied" };
  return null;
}

const inFlight = new Set<string>();
export async function announceUpdateMessage(
  message: UpdateMessage | null,
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> },
  deliver: (message: UpdateMessage) => Promise<boolean>,
) {
  if (!message || inFlight.has(message.id)) return false;
  inFlight.add(message.id);
  try {
    const key = "logic-coin-last-announced-update-v1";
    if (await storage.getItem(key) === message.id) return false;
    if (!await deliver(message)) return false;
    await storage.setItem(key, message.id);
    return true;
  } finally { inFlight.delete(message.id); }
}

export function createUpdateDownloadCheck(api: { checkForUpdateAsync(): Promise<{ isAvailable: boolean }>; fetchUpdateAsync(): Promise<unknown> }, now: () => number = Date.now) {
  let busy = false, lastCheck = -Infinity;
  return async (eligible: () => boolean) => {
    if (!eligible() || busy || now() - lastCheck < 120_000) return false;
    busy = true; lastCheck = now();
    try {
      const result = await api.checkForUpdateAsync();
      if (!result.isAvailable || !eligible()) return false;
      await api.fetchUpdateAsync();
      return true;
    } finally { busy = false; }
  };
}
