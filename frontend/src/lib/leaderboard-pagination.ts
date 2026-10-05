export function shouldLoadLeaderboardPage(input: {
  offset: number;
  viewportHeight: number;
  contentHeight: number;
  hasNextPage: boolean;
  fetching: boolean;
}): boolean {
  if (!input.hasNextPage || input.fetching || input.viewportHeight <= 0 || input.contentHeight <= 0) return false;
  // A user scroll gesture can reach the end even with only 0-4px of overflow.
  return Math.max(0, input.offset) + input.viewportHeight >= input.contentHeight - 180;
}
