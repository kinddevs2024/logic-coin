import app from "./app.js";
import { env } from "./config/env.js";
import { startTelegramLocalPolling, stopTelegramLocalPolling } from "./services/telegram-auth.service.js";
import { settleExpiredDailyContests } from "./services/contest.service.js";

const server = app.listen(env.PORT, () => {
  console.log(`Logic Coin API listening on http://localhost:${env.PORT}`);
  void startTelegramLocalPolling().catch((error) => {
    console.error("Telegram local polling could not start:", error instanceof Error ? error.message : "unknown error");
  });
});

// Expired contests must settle even while nobody opens the challenges screen;
// settlement emits the player-facing "challenge ended / prize ready" push.
const contestSweep = setInterval(() => {
  void settleExpiredDailyContests().catch((error) => {
    console.error("Expired contest sweep failed:", error instanceof Error ? error.message : "unknown error");
  });
}, 5 * 60_000);
void settleExpiredDailyContests().catch(() => undefined);

function shutdown(signal: string): void {
  console.log(`${signal} received; shutting down`);
  stopTelegramLocalPolling();
  clearInterval(contestSweep);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
