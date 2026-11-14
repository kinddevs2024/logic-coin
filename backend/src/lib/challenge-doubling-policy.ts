/** The 2026-11-15 challenge and later no longer offer coin doubling. */
export function challengeDoublingEnabled(dayKey: string): boolean {
  return dayKey < '2026-11-15';
}
