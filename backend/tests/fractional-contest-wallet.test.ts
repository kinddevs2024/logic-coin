import { afterEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import { creditReward } from "../src/services/wallet.service.js";
import { User } from "../src/models/User.js";
import { LedgerEntry } from "../src/models/LedgerEntry.js";
afterEach(() => vi.restoreAllMocks());
const input = {userId: new Types.ObjectId(), amountUnits:0.1, type:"contest_cash_prize" as const, sourceId:"test-micro", description:"fractional prize"};
it.each([0.1, 0.1574, 0.1001])("credits fractional contest prize %s transactionally and records integer micros", async (amountUnits) => {
  const update = vi.spyOn(User,"findOneAndUpdate").mockReturnValue({select: async()=>({wallet:{availableUnits:100.1}})} as never);
  const ledger = vi.spyOn(LedgerEntry,"create").mockResolvedValue([] as never);
  const session = {} as ClientSession;
  expect(await creditReward({...input,amountUnits},session)).toEqual({balanceAfterUnits:100.1});
  expect(update.mock.calls[0]![2]).toMatchObject({session});
  const pipeline = update.mock.calls[0]![1] as unknown as { $set: Record<string, unknown> }[];
  expect(pipeline[0]!.$set["wallet.availableUnits"]).toEqual({$round:[{$add:[{$ifNull:["$wallet.availableUnits",0]},amountUnits]},4]});
  expect(ledger.mock.calls[0]![0]).toEqual([expect.objectContaining({amountUnits,amountMicros:Math.round(amountUnits*10000),sourceId:"test-micro"})]);
  expect(ledger.mock.calls[0]![1]).toEqual({session});
});
it("rejects fractions on other reward paths and amounts below monetary precision", async () => {
  const session = {} as ClientSession;
  await expect(creditReward({...input,type:"task_reward"},session)).rejects.toThrow();
  await expect(creditReward({...input,amountUnits:0.000000001},session)).rejects.toThrow();
  await expect(creditReward({...input,amountUnits:NaN},session)).rejects.toThrow();
});
