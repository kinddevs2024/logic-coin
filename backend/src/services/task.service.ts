import mongoose, { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { localDayKey } from "../lib/date.js";
import { Task } from "../models/Task.js";
import { TaskClaim } from "../models/TaskClaim.js";
import { User } from "../models/User.js";
import { serializeTask, serializeWallet } from "./serialization.service.js";
import { creditReward } from "./wallet.service.js";

function taskFilter(identifier: string) {
  return Types.ObjectId.isValid(identifier)
    ? { $or: [{ _id: new Types.ObjectId(identifier) }, { key: identifier }] }
    : { key: identifier };
}

export async function listTasksForUser(userId: Types.ObjectId) {
  const user = await User.findById(userId).select("preferences.language preferences.timezone");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const tasks = await Task.find({ enabled: true }).sort({ sortOrder: 1, _id: 1 });
  const today = localDayKey(new Date(), user.preferences.timezone);
  const claims = await TaskClaim.find({
    userId,
    taskId: { $in: tasks.map((task) => task._id) },
    localDayKey: today
  })
    .sort({ claimedAt: -1 })
    .lean();

  const claimsByTask = new Map<string, typeof claims>();
  for (const claim of claims) {
    const key = claim.taskId.toString();
    const current = claimsByTask.get(key) ?? [];
    current.push(claim);
    claimsByTask.set(key, current);
  }

  const now = Date.now();
  return tasks.map((task) => {
    const taskClaims = claimsByTask.get(task._id.toString()) ?? [];
    const lastClaimAt = taskClaims[0]?.claimedAt;
    const elapsedSeconds = lastClaimAt ? Math.floor((now - lastClaimAt.getTime()) / 1_000) : Infinity;
    const cooldownRemainingSeconds = Math.max(0, task.cooldownSeconds - elapsedSeconds);
    const remainingToday = Math.max(0, task.dailyLimit - taskClaims.length);
    return {
      ...serializeTask(task, user.preferences.language),
      state: {
        claimsToday: taskClaims.length,
        remainingToday,
        cooldownRemainingSeconds,
        available: remainingToday > 0 && cooldownRemainingSeconds === 0,
        lastClaimedAt: lastClaimAt?.toISOString() ?? null
      }
    };
  });
}

export async function claimTask(input: {
  userId: Types.ObjectId;
  taskIdentifier: string;
  idempotencyKey: string;
}) {
  const previous = await TaskClaim.findOne({
    userId: input.userId,
    idempotencyKey: input.idempotencyKey
  });
  if (previous) {
    const user = await User.findById(input.userId).select("wallet");
    return {
      claim: previous,
      wallet: serializeWallet(user?.wallet),
      idempotentReplay: true
    };
  }

  const session = await mongoose.startSession();
  let awardedClaimId: Types.ObjectId | null = null;
  try {
    await session.withTransaction(async () => {
      // The MongoDB Node driver does not support parallel operations on the
      // same transaction session, so all session-bound queries stay
      // deliberately sequential.
      const user = await User.findById(input.userId)
        .select("preferences.timezone")
        .session(session);
      const task = await Task.findOne({
        ...taskFilter(input.taskIdentifier),
        enabled: true
      }).session(session);
      if (!user) {
        throw new ApiError(404, "user_not_found", "User not found");
      }
      if (!task) {
        throw new ApiError(404, "task_not_found", "Task not found");
      }

      const now = new Date();
      const dayKey = localDayKey(now, user.preferences.timezone);
      const claimsToday = await TaskClaim.countDocuments({
        userId: input.userId,
        taskId: task._id,
        localDayKey: dayKey
      }).session(session);
      const lastClaim = await TaskClaim.findOne({
        userId: input.userId,
        taskId: task._id
      })
        .sort({ claimedAt: -1 })
        .session(session);

      if (claimsToday >= task.dailyLimit) {
        throw new ApiError(429, "task_daily_limit", "Daily task limit has been reached", {
          dailyLimit: task.dailyLimit
        });
      }
      if (lastClaim) {
        const elapsedSeconds = Math.floor((now.getTime() - lastClaim.claimedAt.getTime()) / 1_000);
        if (elapsedSeconds < task.cooldownSeconds) {
          throw new ApiError(429, "task_cooldown", "Task is cooling down", {
            retryAfterSeconds: task.cooldownSeconds - elapsedSeconds
          });
        }
      }

      const [claim] = await TaskClaim.create(
        [
          {
            userId: input.userId,
            taskId: task._id,
            taskKey: task.key,
            idempotencyKey: input.idempotencyKey,
            provider: task.provider,
            rewardUnits: task.rewardUnits,
            localDayKey: dayKey,
            status: "awarded",
            claimedAt: now
          }
        ],
        { session }
      );
      if (!claim) {
        throw new ApiError(500, "claim_failed", "Task claim could not be created");
      }
      awardedClaimId = claim._id;
      await creditReward(
        {
          userId: input.userId,
          amountUnits: task.rewardUnits,
          type: "task_reward",
          sourceId: claim._id.toString(),
          description: `Task reward: ${task.key}`,
          dayKey,
          metadata: { taskKey: task.key, provider: task.provider }
        },
        session
      );
    });
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11_000) {
      const replay = await TaskClaim.findOne({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey
      });
      if (replay) {
        const user = await User.findById(input.userId).select("wallet");
        return {
          claim: replay,
          wallet: serializeWallet(user?.wallet),
          idempotentReplay: true
        };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const [claim, user] = await Promise.all([
    TaskClaim.findById(awardedClaimId),
    User.findById(input.userId).select("wallet")
  ]);
  if (!claim || !user) {
    throw new ApiError(500, "claim_result_unavailable", "Task was claimed but result is unavailable");
  }
  return { claim, wallet: serializeWallet(user.wallet), idempotentReplay: false };
}
