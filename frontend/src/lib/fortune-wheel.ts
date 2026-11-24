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

/** Never offer a wheel that cannot be linked to a saved game result. */
export function canOfferFortune(authenticated: boolean, accessToken: string | null | undefined, attemptId: string | null | undefined): boolean {
  return authenticated && Boolean(accessToken) && Boolean(attemptId);
}

/** Native animation callbacks can be interrupted when an app loses focus. */
export function waitForFortuneSpin(begin: (finish: () => void) => void, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(finish, timeoutMs);
    begin(finish);
  });
}
