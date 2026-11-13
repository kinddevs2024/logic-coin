import { z } from "zod";
const common = {
  destinations: z.array(z.enum(["news", "community"])).min(1).max(2).refine(v => new Set(v).size === v.length).optional(),
  operationId: z.string().uuid(),
  recipientId: z.string().regex(/^[a-f\d]{24}$/i),
  raffleTitle: z.string().trim().min(1).max(160),
};
export const winnerAnnouncementSchema = z.discriminatedUnion("prizeType", [
  z.object({ ...common, prizeType: z.literal("cash"), amountCents: z.number().int().min(1).max(1_000_000_000) }).strict(),
  z.object({ ...common, prizeType: z.literal("item"), prizeText: z.string().trim().min(1).max(160) }).strict(),
]);
export type WinnerAnnouncementInput = z.infer<typeof winnerAnnouncementSchema>;
