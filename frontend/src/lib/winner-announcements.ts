import { authenticatedRequest } from "./api";
export type WinnerRecipient = { id: string; name: string; username?: string | null; referralCode?: string };
export type WinnerDraft = { operationId: string; destinations?: ("news" | "community")[]; recipientId: string; raffleTitle: string } & ({ prizeType: "cash"; amountCents: number } | { prizeType: "item"; prizeText: string });
export type PublishedWinner = { id: string; recipientId: string; recipientName: string; raffleTitle: string; prizeType: "cash" | "item"; amountCents?: number; prizeText?: string; createdAt: string; destinations: { systemKey: "news" | "community"; conversationId: string; messageId: string }[] };
export function parsePrizeCents(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimals = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 1_000_000_000 ? cents : null;
}
export const winnerAnnouncementsApi = {
  recipients: (q: string, token: string) => authenticatedRequest<{ users: WinnerRecipient[] }>(`/admin/winner-announcements/recipients?q=${encodeURIComponent(q)}`, { token }),
  list: (token: string) => authenticatedRequest<{ items: PublishedWinner[] }>("/admin/winner-announcements", { token }),
  publish: (input: WinnerDraft, token: string) => authenticatedRequest<{ announcement: PublishedWinner; replay: boolean }>("/admin/winner-announcements", { token, method: "POST", body: JSON.stringify(input) }),
};
