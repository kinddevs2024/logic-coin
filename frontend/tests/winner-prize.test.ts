import { expect, it, vi } from "vitest";
vi.mock("../src/lib/api", () => ({ authenticatedRequest: vi.fn() }));
import { parsePrizeCents } from "../src/lib/winner-announcements";
it("converts dollar amounts without floating point rounding", () => {
  expect(parsePrizeCents("5.25")).toBe(525); expect(parsePrizeCents("0.01")).toBe(1);
  expect(parsePrizeCents("10,50")).toBe(1050); expect(parsePrizeCents(" 100 ")).toBe(10000);
});
it("rejects empty, zero, negative, excess precision and excessive values", () => {
  for (const value of ["", "0", "-1", "5.001", "1e5", "10,5,2", "10000000.01"]) expect(parsePrizeCents(value)).toBeNull();
});
