import { expect, it } from "vitest";
import { unitsToCents, centsToUnits } from "../src/lib/money.js";
import { serializeWallet } from "../src/services/serialization.service.js";
it("serializes fractional wallet balances and ledger amounts without losing prizes", () => {
  expect(unitsToCents(0.1)).toBe(0.1);
  expect(unitsToCents(0.3035)).toBe(0.3035);
  expect(serializeWallet({availableUnits:100.1,lifetimeEarnedUnits:100.3035})).toMatchObject({availableUnits:100.1,availableCents:100.1,lifetimeEarnedCents:100.3035});
  expect(()=>unitsToCents(Infinity)).toThrow();
  expect(()=>unitsToCents(0.00000001)).toThrow();
  expect(()=>centsToUnits(0.1)).toThrow();
});
