import { create } from "zustand";

export const OFFER_COOLDOWN_MS = 5 * 60 * 1000;
// Only an already-saved result may be covered by the offer, never an active game.
export const useChallengeAdGate = create<{ resultReady: boolean }>(() => ({ resultReady: false }));

export function offerDelay(availableAt: string, serverNow: string, quietUntil: number, now: number) {
  return Math.max(0, Date.parse(availableAt) - Date.parse(serverNow), quietUntil - now);
}
