import { createServer } from "node:http";
import { dayBoundsInTimeZone } from "./lib/date.js";
import { challengeDayKey, ensureDailyChallengeSet } from "./services/daily-challenge.service.js";
import { attachLiveUpdates, broadcastDailyChallengeUpdate } from "./services/live-updates.service.js";
import app from "./app.js";
import { env } from "./config/env.js";
import { startTelegramLocalPolling, stopTelegramLocalPolling } from "./services/telegram-auth.service.js";
import { settleExpiredDailyContests } from "./services/contest.service.js";
import { startNotificationWorker } from "./services/notification.service.js";

const server = createServer(app);
const closeLiveUpdates = attachLiveUpdates(server);
const stopNotificationWorker = startNotificationWorker();
server.listen(env.PORT, () => {
  console.log(`Logic Coin API listening on http://localhost:${env.PORT}`);
  void startTelegramLocalPolling().catch((error) => {
    console.error("Telegram local polling could not start:", error instanceof Error ? error.message : "unknown error");
  });
});

// Expired contests must settle even while nobody opens the challenges screen;
// settlement emits the player-facing "challenge ended / prize ready" push.
let dailyCycleRunning = false;
async function runDailyCycle(): Promise<void> {
  if (dailyCycleRunning) return;
  dailyCycleRunning = true;
  try {
    await settleExpiredDailyContests();
    // Existing draft/published/manual settings are returned untouched.
    await ensureDailyChallengeSet(challengeDayKey());
  } catch (error) {
    console.error("Daily challenge cycle failed:", error instanceof Error ? error.message : "unknown error");
  } finally { dailyCycleRunning = false; }
}
const contestSweep = setInterval(() => { void runDailyCycle(); }, 60_000);
void runDailyCycle();

let rolloverTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleChallengeRollover(): void {
  const dayKey = challengeDayKey();
  const nextMidnight = dayBoundsInTimeZone(dayKey, env.DEFAULT_TIMEZONE).to;
  rolloverTimer = setTimeout(() => {
    const nextDayKey = challengeDayKey();
    void runDailyCycle().then(() => broadcastDailyChallengeUpdate(nextDayKey));
    scheduleChallengeRollover();
  }, Math.max(1_000, nextMidnight.getTime() - Date.now() + 100));
}
scheduleChallengeRollover();


function shutdown(signal: string): void {
  console.log(`${signal} received; shutting down`);
  stopTelegramLocalPolling();
  stopNotificationWorker();
  clearInterval(contestSweep);
  if (rolloverTimer) clearTimeout(rolloverTimer);
  closeLiveUpdates();
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
