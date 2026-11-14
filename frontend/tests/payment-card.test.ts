import { describe, expect, it } from "vitest";

import {
  detectCardBrand,
  formatCardNumber,
  formatExpiration,
  isValidCardNumber,
  isValidExpiration,
  payoutCardDetails,
} from "../src/lib/payment-card";

describe("payment card helpers", () => {
  it("formats and detects Visa and Mastercard without persisting a PAN", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(detectCardBrand("4242 4242")).toBe("visa");
    expect(detectCardBrand("5555 5555")).toBe("mastercard");
  });

  it("validates card checksum and rejects an invalid card", () => {
    expect(isValidCardNumber("4242 4242 4242 4242")).toBe(true);
    expect(isValidCardNumber("4242 4242 4242 4243")).toBe(false);
  });

  it.each([
    ["2220", "other"], ["2221", "mastercard"], ["2229", "mastercard"],
    ["2230", "mastercard"], ["2720", "mastercard"], ["2721", "other"],
    ["51", "mastercard"], ["55", "mastercard"], ["56", "other"],
    ["8600", "uzcard"], ["9860", "humo"], ["", "other"],
  ])("detects prefix %s as %s", (number, brand) => {
    expect(detectCardBrand(number)).toBe(brand);
  });

  it("caps the formatted input at 16 digits but rejects overlong raw values", () => {
    expect(formatCardNumber("4242 4242 4242 4242 424")).toBe("4242 4242 4242 4242");
    expect(isValidCardNumber("4242424242424242424")).toBe(false);
    expect(isValidCardNumber("4242424242424242extra999")).toBe(false);
  });

  it("keeps the private label and date out of new and saved payout requests", () => {
    const localCard = {number: "4242 4242 4242 4242", brand: "visa" as const, last4: "4242", holderName: "Моя зарплатная", expiration: "12/29"};
    expect(payoutCardDetails(localCard)).toEqual({number: "4242424242424242", brand: "visa", last4: "4242"});
    const saved = {...localCard, number: undefined, savedWithdrawalId: "0123456789abcdef01234567"};
    expect(payoutCardDetails(saved)).toEqual({savedWithdrawalId: saved.savedWithdrawalId, brand: "visa", last4: "4242"});
  });

  it("formats and validates a non-expired date", () => {
    expect(formatExpiration("1229")).toBe("12/29");
    expect(isValidExpiration("12/29", new Date("2026-08-23T00:00:00.000Z"))).toBe(true);
    expect(isValidExpiration("07/26", new Date("2026-08-23T00:00:00.000Z"))).toBe(false);
  });
});
