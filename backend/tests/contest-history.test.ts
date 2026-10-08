import { describe, expect, it } from "vitest";
import { validHistoryDay } from "../src/services/contest-history.service.js";
describe("history dates", () => {
  it("accepts real dates including leap day", () => {
    expect(validHistoryDay("2026-10-08")).toBe(true);
    expect(validHistoryDay("2024-02-29")).toBe(true);
  });
  it("rejects rolled dates and malformed input", () => {
    for (const day of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "x", "2026-1-1"])
      expect(validHistoryDay(day)).toBe(false);
  });
});
