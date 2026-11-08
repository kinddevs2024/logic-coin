import { expect, it, vi } from "vitest";
vi.mock("../src/store/app-store", () => ({ useAppStore: { getState: () => ({language:"ru"}) } }));
import { formatMoney } from "../src/lib/format";
it("preserves whole-cent formatting and shows fractional cash prizes", () => {
  for (const [units, label] of [[250,"$2.50"],[1,"$0.01"],[0.1,"$0.001"],[0.3035,"$0.003035"],[0.0001,"$0.000001"],[0,"$0.00"]] as const) {
    expect(formatMoney(units)).toBe(label);
  }
});
