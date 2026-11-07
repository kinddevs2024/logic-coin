export type AppliedUpdate = { enabled: boolean; embedded: boolean; id: string | null };
const KEY = "logic-coin-last-announced-update-v1";
export async function announceAppliedUpdate(
  update: AppliedUpdate,
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> },
  announce: () => boolean,
) {
  if (!update.enabled || update.embedded || !update.id) return false;
  if (await storage.getItem(KEY) === update.id) return false;
  if (!announce()) return false;
  await storage.setItem(KEY, update.id);
  return true;
}
