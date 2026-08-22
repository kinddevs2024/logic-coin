import type { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { canonicalGameKey } from "../lib/game-key.js";
import { Game } from "../models/Game.js";
import { User } from "../models/User.js";
import { serializeGame } from "./serialization.service.js";

async function resolveLanguage(userId: Types.ObjectId): Promise<"en" | "ru" | "uz"> {
  const user = await User.findById(userId).select("preferences.language");
  return user?.preferences.language ?? "ru";
}

export async function listGamesForUser(userId: Types.ObjectId) {
  const language = await resolveLanguage(userId);
  const games = await Game.find({ enabled: true, practiceEnabled: true })
    .sort({ sortOrder: 1, _id: 1 })
    .lean();
  return games.map((game) => serializeGame(game, language));
}

export async function findActiveGameByKey(gameKey: string) {
  const game = await Game.findOne({ key: canonicalGameKey(gameKey), enabled: true });
  if (!game) {
    throw new ApiError(404, "game_not_found", "Game not found");
  }
  return game;
}
