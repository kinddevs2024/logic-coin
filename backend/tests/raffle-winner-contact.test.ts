import { describe, it, expect, vi, afterEach } from "vitest";
import { captureRaffleWinnerReply, winnerReplyContent } from "../src/services/raffle-winner-contact.service.js";
import { RaffleWinNotice, RaffleWinnerReply } from "../src/models/RaffleWinNotice.js";
import { NotificationEvent } from "../src/models/NotificationEvent.js";
const relay = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "support-message", seq: 1 }));
vi.mock("../src/services/chat.service.js", () => ({ relaySupportReply: relay }));
import { User } from "../src/models/User.js";

afterEach(() => { vi.restoreAllMocks(); relay.mockClear(); });

describe("winner contact intake", () => {
  const base = { message_id: 1, chat: { id: 12, type: "private" }, from: { id: 12 } };
  it("accepts private contact text and the sender's own contact card", () => {
    expect(winnerReplyContent({ ...base, text: " +998901234567 " })).toBe("+998901234567");
    expect(winnerReplyContent({ ...base, contact: { user_id: 12, phone_number: "+998901234567" } })).toBe("+998901234567");
  });
  it("does not collect groups, commands or someone else's contact card", () => {
    expect(winnerReplyContent({ ...base, chat: { id: 12, type: "group" }, text: "hello" })).toBeNull();
    expect(winnerReplyContent({ ...base, text: "/start" })).toBeNull();
    expect(winnerReplyContent({ ...base, contact: { user_id: 99, phone_number: "+1" } })).toBeNull();
    expect(winnerReplyContent({ ...base, from: { id: 99 }, text: "hello" })).toBeNull();
  });
});

describe("winner reply routing", () => {
  const message = { message_id: 12, chat: { id: 42, type: "private" }, from: { id: 42 }, text: "+998901234567" };
  function winner(value: unknown) {
    vi.spyOn(RaffleWinNotice, "findOne").mockReturnValue({ sort: () => ({ lean: async () => value }) } as never);
  }
  it("does not capture ordinary users' conversations", async () => {
    winner(null);
    const save = vi.spyOn(RaffleWinnerReply, "findOneAndUpdate");
    expect(await captureRaffleWinnerReply(message)).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
  it("delivers a private inbox event only to administrators", async () => {
    winner({ userId: "winner", amountCents: 500, round: 17 });
    vi.spyOn(RaffleWinnerReply, "findOneAndUpdate").mockResolvedValue({ _id: "reply" } as never);
    vi.spyOn(User, "find").mockReturnValue({ select: () => ({ lean: async () => [{ _id: "admin" }] }) } as never);
    const event = vi.spyOn(NotificationEvent, "updateOne").mockResolvedValue({} as never);
    vi.spyOn(RaffleWinnerReply, "updateOne").mockResolvedValue({} as never);
    expect(await captureRaffleWinnerReply(message)).toBe(true);
    expect(event).not.toHaveBeenCalled();
    expect(relay).toHaveBeenCalledWith("winner", "+998901234567", "telegram:42:12");
  });
  it("does not notify twice for a webhook already delivered to the admin", async () => {
    winner({ userId: "winner", amountCents: 500, round: 17 });
    vi.spyOn(RaffleWinnerReply, "findOneAndUpdate").mockResolvedValue({ _id: "reply", forwardedAt: new Date() } as never);
    const event = vi.spyOn(NotificationEvent, "updateOne");
    expect(await captureRaffleWinnerReply(message)).toBe(true);
    expect(event).not.toHaveBeenCalled();
  });
});
