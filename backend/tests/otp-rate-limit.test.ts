import { beforeEach, describe, expect, it, vi } from "vitest";

const otpMocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  deleteOne: vi.fn(),
  updateMany: vi.fn(),
}));
const emailMocks = vi.hoisted(() => ({ sendVerificationCode: vi.fn() }));

vi.mock("../src/models/OtpChallenge.js", () => ({ OtpChallenge: otpMocks }));
vi.mock("../src/services/email.service.js", () => emailMocks);

import { createAndSendOtp } from "../src/services/otp.service.js";

function sorted(result: unknown) {
  return { sort: vi.fn().mockResolvedValue(result) };
}

describe("verification email throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    otpMocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
    otpMocks.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  it("enforces the rolling maximum of three emails", async () => {
    otpMocks.countDocuments.mockResolvedValue(3);
    otpMocks.findOne.mockReturnValue(sorted({ sentAt: new Date() }));

    await expect(createAndSendOtp("User@Example.com")).rejects.toMatchObject({
      statusCode: 429,
      code: "otp_daily_limit",
      details: expect.objectContaining({ sendsRemaining: 0 }),
    });
    expect(emailMocks.sendVerificationCode).not.toHaveBeenCalled();
  });

  it("enforces a sixty-second pause between emails", async () => {
    otpMocks.countDocuments.mockResolvedValue(1);
    otpMocks.findOne.mockReturnValue(sorted({ sentAt: new Date(Date.now() - 5_000) }));

    await expect(createAndSendOtp("user@example.com")).rejects.toMatchObject({
      statusCode: 429,
      code: "otp_cooldown",
      details: expect.objectContaining({ retryAfterSeconds: expect.any(Number) }),
    });
  });

  it("reports the cooldown and remaining quota after a successful send", async () => {
    otpMocks.countDocuments.mockResolvedValue(0);
    otpMocks.findOne.mockReturnValue(sorted(null));
    otpMocks.create.mockResolvedValue({ _id: "challenge-1" });
    emailMocks.sendVerificationCode.mockResolvedValue("sent");

    await expect(createAndSendOtp("user@example.com")).resolves.toMatchObject({
      delivery: "sent",
      resendAvailableInSeconds: 60,
      sendsRemaining: 2,
    });
    expect(emailMocks.sendVerificationCode).toHaveBeenCalledOnce();
  });
});
