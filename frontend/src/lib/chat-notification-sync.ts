import { NativeModules, Platform } from "react-native";
import { useAppStore } from "@/store/app-store";

export type ChatReadReceipt = { recipientId: string; conversationId: string; readSeq: number; ids: string[] };
type NativeSync = { version: number; configure(account: string | null): Promise<boolean>; acknowledge(account: string, conversation: string, sequence: number, ids: string[]): Promise<boolean> };
function nativeSync(): NativeSync | undefined { return Platform.OS === "android" ? NativeModules.ChatNotificationSync : undefined; }
export function chatNotificationSyncVersion(): number { return nativeSync()?.version === 1 ? 1 : 0; }
export async function configureChatNotificationAccount(account: string | null) { await nativeSync()?.configure(account); }
export async function applyChatReadReceipt(receipt: ChatReadReceipt) {
  if (useAppStore.getState().user.id !== receipt.recipientId) return;
  await nativeSync()?.acknowledge(receipt.recipientId, receipt.conversationId, receipt.readSeq, receipt.ids);
  const { dismissInboxNotifications } = await import("./notifications");
  await dismissInboxNotifications(receipt.ids);
}
