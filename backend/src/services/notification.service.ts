import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { Device } from "../models/Device.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { NotificationEvent } from "../models/NotificationEvent.js";

const EXPO_BATCH_SIZE = 100;

function expoToken(value: unknown): value is string {
  return typeof value === "string" && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value);
}

function batches<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function dispatchNotificationEvent(
  eventId: Types.ObjectId | string,
  fetchImplementation: typeof fetch = fetch
) {
  const event = await NotificationEvent.findOneAndUpdate(
    { _id: eventId, status: "queued" },
    { $set: { status: "processing" }, $unset: { failureReason: 1 } },
    { new: true }
  ).lean();
  if (!event) return { status: "skipped" as const, targetCount: 0, sentCount: 0, failedCount: 0 };

  try {
    const payload = (event.payload ?? {}) as { dayKey?: string; title?: string; body?: string };
    const participantUserIds =
      event.audience === "contest_participants" && payload.dayKey
        ? await DailyContestResult.distinct("userId", { dayKey: payload.dayKey })
        : null;
    const devices = await Device.find({
      notificationsEnabled: true,
      pushToken: { $exists: true, $ne: "" },
      ...(participantUserIds ? { userId: { $in: participantUserIds } } : {})
    })
      .select("pushToken")
      .lean();
    const tokens = [...new Set(devices.map((device) => device.pushToken).filter(expoToken))];
    let sentCount = 0;
    let failedCount = 0;

    for (const tokenBatch of batches(tokens, EXPO_BATCH_SIZE)) {
      const response = await fetchImplementation(env.EXPO_PUSH_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(env.EXPO_PUSH_ACCESS_TOKEN
            ? { authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` }
            : {})
        },
        body: JSON.stringify(
          tokenBatch.map((to) => ({
            to,
            sound: "default",
            title: payload.title ?? "Новый челлендж доступен",
            body: payload.body ?? "Шесть новых игр уже ждут вас.",
            data: { type: event.type, dayKey: payload.dayKey ?? null }
          }))
        ),
        signal: AbortSignal.timeout(8_000)
      });
      if (!response.ok) {
        failedCount += tokenBatch.length;
        continue;
      }
      const responseBody = (await response.json()) as {
        data?: Array<{ status?: "ok" | "error" }>;
      };
      const tickets = Array.isArray(responseBody.data) ? responseBody.data : [];
      for (let index = 0; index < tokenBatch.length; index += 1) {
        if (tickets[index]?.status === "ok") sentCount += 1;
        else failedCount += 1;
      }
    }

    const status = failedCount > 0 ? "failed" : "sent";
    const failureReason = failedCount > 0 ? `${failedCount} Expo push notification(s) failed` : null;
    await NotificationEvent.updateOne(
      { _id: event._id, status: "processing" },
      {
        $set: {
          status,
          targetCount: tokens.length,
          sentCount,
          failedCount,
          processedAt: new Date(),
          ...(failureReason ? { failureReason } : {})
        },
        ...(!failureReason ? { $unset: { failureReason: 1 } } : {})
      }
    );
    return { status, targetCount: tokens.length, sentCount, failedCount };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message.slice(0, 240) : "Push delivery failed";
    await NotificationEvent.updateOne(
      { _id: event._id, status: "processing" },
      {
        $set: {
          status: "failed",
          failedCount: event.targetCount,
          processedAt: new Date(),
          failureReason
        }
      }
    );
    return {
      status: "failed" as const,
      targetCount: event.targetCount,
      sentCount: 0,
      failedCount: event.targetCount
    };
  }
}
