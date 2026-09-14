import app from "./app.js";
import { env } from "./config/env.js";
import { startTelegramLocalPolling, stopTelegramLocalPolling } from "./services/telegram-auth.service.js";

const server = app.listen(env.PORT, () => {
  console.log(`Logic Coin API listening on http://localhost:${env.PORT}`);
  void startTelegramLocalPolling().catch((error) => {
    console.error("Telegram local polling could not start:", error instanceof Error ? error.message : "unknown error");
  });
});

function shutdown(signal: string): void {
  console.log(`${signal} received; shutting down`);
  stopTelegramLocalPolling();
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
