import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gameFindOne: vi.fn(),
  gameUpdateOne: vi.fn(),
  gameDeleteOne: vi.fn(),
  challengeExists: vi.fn(),
  attemptExists: vi.fn()
}));

vi.mock("../src/models/Game.js", () => ({
  Game: {
    findOne: mocks.gameFindOne,
    updateOne: mocks.gameUpdateOne,
    deleteOne: mocks.gameDeleteOne,
    bulkWrite: vi.fn()
  }
}));
vi.mock("../src/models/DailyChallengeSet.js", () => ({
  DailyChallengeSet: { exists: mocks.challengeExists }
}));
vi.mock("../src/models/ChallengeAttempt.js", () => ({
  ChallengeAttempt: { exists: mocks.attemptExists, updateMany: vi.fn() }
}));

import { DEFAULT_GAMES, retireRemovedGames } from "../src/services/game-seed.service.js";

describe("removed game retirement", () => {
  const removedId = new Types.ObjectId();

  beforeEach(() => {
    mocks.gameFindOne.mockReset();
    mocks.gameUpdateOne.mockReset();
    mocks.gameDeleteOne.mockReset();
    mocks.challengeExists.mockReset();
    mocks.attemptExists.mockReset();
    mocks.gameFindOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: removedId }) });
  });

  it("does not seed Gold Rush anymore and disables it when history references it", async () => {
    expect(DEFAULT_GAMES.some((game) => game.key === "gold-rush-2048")).toBe(false);
    mocks.challengeExists.mockResolvedValue({ _id: new Types.ObjectId() });
    mocks.attemptExists.mockResolvedValue(null);
    await retireRemovedGames();
    expect(mocks.gameUpdateOne).toHaveBeenCalledWith(
      { _id: removedId },
      { $set: { enabled: false, challengeEnabled: false, practiceEnabled: false } }
    );
    expect(mocks.gameDeleteOne).not.toHaveBeenCalled();
  });

  it("deletes the retired game when no challenge history references it", async () => {
    mocks.challengeExists.mockResolvedValue(null);
    mocks.attemptExists.mockResolvedValue(null);
    await retireRemovedGames();
    expect(mocks.gameDeleteOne).toHaveBeenCalledWith({ _id: removedId });
  });
});
