/** Persisted presentation state only; this never changes or awards money. */
export type SavingsCashSnapshot = {
  accountId: string;
  balanceUnits: number;
  seenUnits: number;
  eventId: number;
};

export function observeSavingsCash(
  previous: SavingsCashSnapshot | null,
  accountId: string | undefined,
  balanceUnits: number | undefined,
): SavingsCashSnapshot | null {
  if (!accountId || balanceUnits === undefined || !Number.isFinite(balanceUnits) || balanceUnits < 0) return previous;
  // A first login (or a different account) is a baseline, not a reward.
  if (!previous || previous.accountId !== accountId) {
    return { accountId, balanceUnits, seenUnits: balanceUnits, eventId: 0 };
  }
  if (balanceUnits === previous.balanceUnits) return previous;
  return {
    ...previous,
    balanceUnits,
    // Withdrawals lower the baseline, so a later reward still animates even
    // when the new balance is below a historic maximum.
    seenUnits: Math.min(previous.seenUnits, balanceUnits),
    eventId: previous.eventId + (balanceUnits > previous.balanceUnits ? 1 : 0),
  };
}

export function pendingSavingsCash(
  snapshot: SavingsCashSnapshot | null,
  accountId: string | undefined,
): number | null {
  return snapshot && snapshot.accountId === accountId && snapshot.balanceUnits > snapshot.seenUnits
    ? snapshot.eventId
    : null;
}

export function acknowledgeSavingsCash(
  snapshot: SavingsCashSnapshot | null,
  accountId: string,
  eventId: number,
): SavingsCashSnapshot | null {
  // An old animation cannot consume a newer credit or another user's reward.
  if (!snapshot || snapshot.accountId !== accountId || snapshot.eventId !== eventId ||
      snapshot.seenUnits === snapshot.balanceUnits) return snapshot;
  return { ...snapshot, seenUnits: snapshot.balanceUnits };
}
