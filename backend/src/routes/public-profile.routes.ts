import { Router } from "express";
import { z } from "zod";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { User } from "../models/User.js";
import { GameProgress } from "../models/GameProgress.js";
import { ApiError } from "../lib/api-error.js";

const router = Router();
const codeSchema = z.string().trim().regex(/^[A-Z0-9-]{4,32}$/i);

router.get("/:referralCode", async (request, response) => {
  const parsed = codeSchema.safeParse(request.params.referralCode);
  if (!parsed.success) throw new ApiError(400, "invalid_profile_code", "Profile code is invalid");
  const user = await User.findOne({ referralCode: parsed.data.toUpperCase() }).select("name avatarUrl wallet coins referralCode").lean();
  if (!user) throw new ApiError(404, "profile_not_found", "Profile not found");
  const completedChallenges = await ChallengeAttempt.countDocuments({ userId: user._id, mode: "challenge", status: "completed" });
  const progress = await GameProgress.findOne({ userId: user._id }).select("games").lean();
  const games = progress?.games && typeof progress.games === "object"
    ? progress.games as Record<string, { unlockedCosmetics?: unknown }>
    : {};
  const skins = Object.entries(games).flatMap(([gameKey, state]) =>
    Array.isArray(state?.unlockedCosmetics)
      ? state.unlockedCosmetics
          .filter((skin): skin is string => typeof skin === "string" && skin !== "classic")
          .map((skin) => `${gameKey}:${skin}`)
      : [],
  );
  response.json({
    data: {
      profile: {
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        referralCode: user.referralCode,
        balanceUnits: user.wallet?.availableUnits ?? 0,
        lifetimeEarnedUnits: user.wallet?.lifetimeEarnedUnits ?? 0,
        coinBalance: user.coins?.balance ?? 0,
        lifetimeCoins: user.coins?.lifetimeEarned ?? 0,
        completedChallenges,
        skins
      }
    }
  });
});

export default router;
