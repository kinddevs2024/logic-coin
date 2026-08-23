import { env } from "../config/env.js";

export async function notifyWithdrawalAdmin(input: {
  withdrawalId: string;
  userId: string;
  amountCents: number;
  accountLabel: string;
}): Promise<"sent" | "disabled" | "failed"> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) {
    return "disabled";
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
          text: [
            "Logic Coin withdrawal review request",
            `Withdrawal: ${input.withdrawalId}`,
            `User: ${input.userId}`,
            `Amount: $${(input.amountCents / 100).toFixed(2)}`,
            `Card: ${input.accountLabel}`
          ].join("\n")
        }),
        signal: AbortSignal.timeout(4_000)
      }
    );
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
