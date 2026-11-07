// Match the server's fixed coin rewards, including its two separate +200 slots.
export const FORTUNE_WHEEL_PRIZES = ["+200", "+150", "+200", "+100", "+50"] as const;

export function fortuneWheelOutcome(selected: string | null) {
  const prizes: string[] = [...FORTUNE_WHEEL_PRIZES];
  let index = selected ? prizes.indexOf(selected) : 0;
  // A newer server may introduce another amount. Show that exact amount rather
  // than silently pointing at a different prize on older clients.
  if (index < 0) {
    index = 0;
    if (selected && /^\+\d+$/.test(selected)) prizes[index] = selected;
  }
  return { prizes, index, angle: 1440 + 360 - (index * 72 + 36) };
}
