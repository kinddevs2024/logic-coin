import { Types } from "mongoose";
import { beforeEach, expect, it, vi } from "vitest";
const source = vi.hoisted(() => ({ legacy: vi.fn(), logins: vi.fn(), games: vi.fn(), users: vi.fn() }));
vi.mock("../src/config/env.js", () => ({ env: { DEFAULT_TIMEZONE: "Asia/Tashkent" } }));
vi.mock("../src/models/ActivityDay.js", () => ({ ActivityDay: { distinct: source.legacy } }));
vi.mock("../src/models/CoinRewardLogin.js", () => ({ CoinRewardLogin: { distinct: source.logins } }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: { distinct: source.games } }));
vi.mock("../src/models/User.js", () => ({ User: { distinct: source.users } }));
import { countActivePlayers } from "../src/services/admin-activity.service.js";
beforeEach(() => { for (const mock of Object.values(source)) mock.mockReset().mockResolvedValue([]); });
it("counts current coin-game players even when the legacy LC journal is empty", async () => {
  const a = new Types.ObjectId(), b = new Types.ObjectId(), c = new Types.ObjectId();
  source.logins.mockResolvedValue([a, b]);
  source.games.mockResolvedValue([new Types.ObjectId(a.toHexString()), c]);
  source.users.mockResolvedValue([b]);
  expect(await countActivePlayers("2026-10-30")).toBe(3);
});
it("retains legacy-only activity and returns zero for an empty day", async () => {
  expect(await countActivePlayers("2026-10-30")).toBe(0);
  source.legacy.mockResolvedValue([new Types.ObjectId()]);
  expect(await countActivePlayers("2026-10-30")).toBe(1);
});
it("uses the admin timezone, includes resumed completions and has an exclusive end", async () => {
  await countActivePlayers("2026-10-29", "2026-10-30");
  const during = { $gte: new Date("2026-10-28T19:00:00Z"), $lt: new Date("2026-10-30T19:00:00Z") };
  expect(source.games).toHaveBeenCalledWith("userId", { $or: [{ startedAt: during }, { completedAt: during }] });
  expect(source.logins).toHaveBeenCalledWith("userId", { createdAt: during });
  expect(source.legacy).toHaveBeenCalledWith("userId", { dayKey: { $gte: "2026-10-29", $lte: "2026-10-30" } });
});
