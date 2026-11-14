import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ modules: {} as Record<string, unknown>, dismiss: vi.fn(), account: "111111111111111111111111" }));
vi.mock("react-native", () => ({ Platform: { OS: "android" }, NativeModules: mocks.modules }));
vi.mock("../src/store/app-store", () => ({ useAppStore: { getState: () => ({ user: { id: mocks.account } }) } }));
vi.mock("../src/lib/notifications", () => ({ dismissInboxNotifications: mocks.dismiss }));
import { applyChatReadReceipt, chatNotificationSyncVersion, configureChatNotificationAccount } from "../src/lib/chat-notification-sync";
const receipt = { recipientId: "111111111111111111111111", conversationId: "222222222222222222222222", readSeq: 10, ids: ["event:333333333333333333333333"] };
beforeEach(() => { vi.clearAllMocks(); delete mocks.modules.ChatNotificationSync; });
it("keeps older installed APKs working without the new native module", async () => {
  expect(chatNotificationSyncVersion()).toBe(0); await configureChatNotificationAccount(mocks.account); await applyChatReadReceipt(receipt);
  expect(mocks.dismiss).toHaveBeenCalledWith(receipt.ids);
});
it("uses the native receipt handler only when it is present", async () => {
  const acknowledge = vi.fn().mockResolvedValue(true), configure = vi.fn().mockResolvedValue(true);
  mocks.modules.ChatNotificationSync = { version: 1, acknowledge, configure };
  expect(chatNotificationSyncVersion()).toBe(1); await configureChatNotificationAccount(mocks.account); await applyChatReadReceipt(receipt);
  expect(acknowledge).toHaveBeenCalledWith(receipt.recipientId, receipt.conversationId, receipt.readSeq, receipt.ids);
});
it("does not clear notifications belonging to a different signed-in account", async () => {
  await applyChatReadReceipt({ ...receipt, recipientId: receipt.conversationId }); expect(mocks.dismiss).not.toHaveBeenCalled();
});
