import { afterEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";
vi.mock("../src/config/env.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/config/env.js")>();
  return { ...actual, env: { ...actual.env, DEFAULT_TIMEZONE: "Asia/Tashkent" } };
});
import { CoinLedgerEntry } from "../src/models/CoinLedgerEntry.js";
import { getCoinsEarnedToday } from "../src/services/coin.service.js";

afterEach(() => vi.restoreAllMocks());
it("counts all earned coins for only this user within Tashkent day boundaries", async () => {
  const userId = new Types.ObjectId();
  const aggregate = vi.spyOn(CoinLedgerEntry, "aggregate").mockResolvedValue([{ total: 8494 }]);
  expect(await getCoinsEarnedToday(userId, new Date("2026-11-07T22:30:00Z"))).toEqual({
    dayKey: "2026-11-08", earned: 8494, resetsAt: "2026-11-08T19:00:00.000Z",
  });
  expect(aggregate).toHaveBeenCalledWith([
    { $match: { userId, createdAt: { $gte: new Date("2026-11-07T19:00:00Z"), $lt: new Date("2026-11-08T19:00:00Z") } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
});
it("returns zero for a new day without entries instead of lifetime balance", async () => {
  vi.spyOn(CoinLedgerEntry, "aggregate").mockResolvedValue([]);
  expect((await getCoinsEarnedToday(new Types.ObjectId(), new Date("2026-11-08T19:00:00Z")))).toMatchObject({ dayKey: "2026-11-09", earned: 0 });
});
