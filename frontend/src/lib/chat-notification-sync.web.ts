import { useAppStore } from "@/store/app-store";
export type ChatReadReceipt = { recipientId: string; conversationId: string; readSeq: number; ids: string[] };
let version = 0;
export function chatNotificationSyncVersion() { return version; }
export async function configureChatNotificationAccount(account: string | null) {
  version = 0;
  const registration = await navigator.serviceWorker?.getRegistration("/");
  if (!registration) return;
  const installing = registration.installing ?? registration.waiting;
  if (installing && installing.state !== "activated" && installing.state !== "redundant") await new Promise<void>(resolve => {
    const changed = () => { if (installing.state === "activated" || installing.state === "redundant") { clearTimeout(timer); installing.removeEventListener("statechange", changed); resolve(); } };
    const timer = setTimeout(() => { installing.removeEventListener("statechange", changed); resolve(); }, 3000);
    installing.addEventListener("statechange", changed);
  });
  if (!registration.active) return;
  version = await new Promise<number>(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(0); }, 1500);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data?.version === 1 ? 1 : 0); };
    registration.active!.postMessage({ type: "logic-notification-account", account }, [channel.port2]);
  });
}
export async function applyChatReadReceipt(receipt: ChatReadReceipt) {
  if (useAppStore.getState().user.id !== receipt.recipientId) return;
  const registration = await navigator.serviceWorker?.getRegistration("/");
  registration?.active?.postMessage({ type: "logic-chat-read", receipt });
  const { dismissInboxNotifications } = await import("./notifications");
  await dismissInboxNotifications(receipt.ids);
}
