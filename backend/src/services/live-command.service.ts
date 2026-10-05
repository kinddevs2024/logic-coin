import { z } from "zod";
import type { Types } from "mongoose";
import { MAX_CHALLENGE_DURATION_MS, MAX_CHALLENGE_SCORE } from "../config/constants.js";
import { ApiError } from "../lib/api-error.js";
import { requireNativeChallengeClient } from "../lib/native-client.js";
import { startChallengeAttempt, completeChallengeAttempt, completePracticeAttempt, doubleChallengeCoins } from "./challenge-attempt.service.js";
import { getTodayChallengeOverview } from "./daily-challenge.service.js";
import { getPendingContestReward, claimContestReward } from "./contest.service.js";

const game = z.string().regex(/^[a-z0-9-]{1,80}$/);
const completion = z.object({ gameKey: game, score: z.number().int().min(0).max(MAX_CHALLENGE_SCORE), durationMs: z.number().int().min(0).max(MAX_CHALLENGE_DURATION_MS).optional() }).strict();
export async function executeLiveCommand(userId: Types.ObjectId, method: string, input: unknown, nativeClient = false) {
  if (["start", "complete", "double"].includes(method)) requireNativeChallengeClient(nativeClient);
  switch (method) {
    case "today": return getTodayChallengeOverview(userId);
    case "pendingReward": return getPendingContestReward(userId);
    case "start": return startChallengeAttempt({ userId, ...z.object({ gameKey: game }).strict().parse(input) });
    case "complete":
    case "completePractice": {
      const body = completion.parse(input);
      const args = { userId, gameKey: body.gameKey, score: body.score, ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {}) };
      return method === "complete" ? completeChallengeAttempt(args) : completePracticeAttempt(args);
    }
    case "double": {
      const body = z.object({ scope: z.enum(["game", "day"]), ad: z.object({ provider: z.enum(["demo", "yandex", "appodeal"]), receiptId: z.string().min(1).max(180) }).strict().optional() }).strict().parse(input);
      return doubleChallengeCoins({ userId, scope: body.scope, ...(body.ad ? { ad: body.ad } : {}) });
    }
    case "claimReward": return claimContestReward(z.object({ resultId: z.string().regex(/^[a-f0-9]{24}$/i) }).strict().parse(input).resultId, userId);
    default: throw new ApiError(400, "unknown_command", "Unknown command");
  }
}
