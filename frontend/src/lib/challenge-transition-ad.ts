// A Next tap already attempted the ad. Mounting its target must not show it twice.
let preparedEntry: { day: string; game: string } | null = null;
export function prepareChallengeAdEntry(day: string, game: string) { preparedEntry = { day, game }; }
export function consumeChallengeAdEntry(day: string, game: string): boolean {
  const prepared = preparedEntry;
  preparedEntry = null;
  return prepared?.day === day && prepared.game === game;
}
