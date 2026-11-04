import { describe, it, expect } from "vitest";
import { winnerReplyContent } from "../src/services/raffle-winner-contact.service.js";

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
