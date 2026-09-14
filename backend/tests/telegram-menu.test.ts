import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  updateUser: vi.fn(),
  conversation: vi.fn(),
  findTimers: vi.fn(),
  updateTimer: vi.fn(),
  findChallenge: vi.fn()
}));
vi.mock("../src/models/User.js", () => ({
  User: {
    db: { readyState: 1 },
    findOne: mocks.findUser,
    updateOne: mocks.updateUser
  }
}));
vi.mock("../src/models/TelegramConversation.js", () => ({
  TelegramConversation: {
    findOneAndUpdate: mocks.conversation,
    find: mocks.findTimers,
    updateOne: mocks.updateTimer
  }
}));
vi.mock("../src/models/DailyChallengeSet.js", () => ({
  DailyChallengeSet: { findOne: mocks.findChallenge }
}));
import {
  handleTelegramMenu,
  home,
  parseAmount,
  privateSender,
  refreshChallengeTimers,
  TIMER_REFRESH_BATCH_SIZE,
  validExpiration
} from "../src/services/telegram-menu.service.js";

const message = (text: string, id = 1) => ({ message_id: id, text, chat: { id: 123, type: "private" }, from: { id: 123, first_name: "Test" } });
describe("restored Telegram menu", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, result: { message_id: 456 } }) })); });
  it("keeps account/settings buttons alongside the Mini App", () => {
    const buttons = home.flat();
    expect(buttons.map(b => b.text)).toEqual(expect.arrayContaining(["👤 Аккаунт", "⚙️ Настройки", "💰 Баланс", "🎮 Mini App"]));
    expect(buttons.find(b => "web_app" in b)).toMatchObject({
      web_app: { url: expect.stringMatching(/\/login\?v=/) }
    });
  });
  it("rejects groups, mismatched senders, and bot senders", async () => {
    expect(privateSender({ ...message("/balance"), chat: { id: -1, type: "group" } })).toBeNull();
    expect(privateSender({ ...message("/balance"), from: { id: 999 } })).toBeNull();
    expect(privateSender({ ...message("/balance"), from: { id: 123, is_bot: true } })).toBeNull();
    expect(await handleTelegramMenu({ ...message("/balance"), chat: { id: -1, type: "group" } })).toBe(false);
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("changes the linked account settings once even when Telegram retries delivery", async () => {
    const state = { expiresAt: new Date(Date.now() + 60000), step: "", data: {}, lastMessageId: 0, markModified: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
    mocks.conversation.mockResolvedValue(state);
    mocks.findUser.mockResolvedValue({ _id: "linked-user", preferences: { notificationsEnabled: true } });
    mocks.updateUser.mockResolvedValue({ matchedCount: 1 });
    await handleTelegramMenu(message("🔔 Уведомления"));
    expect(mocks.updateUser).toHaveBeenCalledWith({ _id: "linked-user" }, { $set: { "preferences.notificationsEnabled": false } });
    await handleTelegramMenu(message("🔔 Уведомления"));
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });
  it("validates amounts and card expiry", () => {
    expect(parseAmount("10,25")).toBe(1025);
    expect(parseAmount("-10")).toBeNull();
    expect(parseAmount("10.999")).toBeNull();
    expect(parseAmount("1234567890123456")).toBeNull();
    expect(validExpiration("09/26", new Date("2026-09-13"))).toBe(true);
    expect(validExpiration("08/26", new Date("2026-09-13"))).toBe(false);
  });
  it("rotates countdown updates across more conversations than one tick can serve", async () => {
    const activeChallenge = {
      dayKey: "2026-09-13",
      cashPrizeMaxUnits: 100,
      endsAt: new Date(Date.now() + 60 * 60_000)
    };
    mocks.findChallenge.mockReturnValue({ lean: vi.fn().mockResolvedValue(activeChallenge) });
    const firstBatch = Array.from({ length: TIMER_REFRESH_BATCH_SIZE }, (_, index) => ({
      _id: `first-${index}`,
      telegramId: `chat-${index}`,
      timerMessageId: index + 1
    }));
    const deferredConversation = {
      _id: "deferred",
      telegramId: "chat-deferred",
      timerMessageId: 999
    };
    const limit = vi
      .fn()
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce([deferredConversation]);
    const sort = vi.fn().mockReturnValue({ limit });
    mocks.findTimers.mockReturnValue({ sort });
    mocks.updateTimer.mockResolvedValue({ modifiedCount: 1 });

    await refreshChallengeTimers();
    await refreshChallengeTimers();

    expect(sort).toHaveBeenCalledWith({ lastTimerRefreshAt: 1, _id: 1 });
    expect(mocks.updateTimer).toHaveBeenCalledTimes(TIMER_REFRESH_BATCH_SIZE + 1);
    expect(mocks.updateTimer).toHaveBeenCalledWith(
      { _id: "deferred" },
      { $set: { lastTimerRefreshAt: expect.any(Date) } }
    );
  });
});
