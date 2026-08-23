import { describe, expect, it } from "vitest";

import {
  detectCardBrand,
  formatCardNumber,
  formatExpiration,
  isValidCardNumber,
  isValidExpiration,
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

  it("formats and validates a non-expired date", () => {
    expect(formatExpiration("1229")).toBe("12/29");
    expect(isValidExpiration("12/29", new Date("2026-08-23T00:00:00.000Z"))).toBe(true);
    expect(isValidExpiration("07/26", new Date("2026-08-23T00:00:00.000Z"))).toBe(false);
  });
});
