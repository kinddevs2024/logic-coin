// Count real content changes, including chats sharing the /messages route.
export function isAdNavigationScreen(path: string): boolean {
  return path.startsWith("/") && !/^\/(?:login|register|verify|set-password|telegram-login|oauth|admin|raffle|play|country|language|onboarding)(?:\/|$)/.test(path)
    && !path.startsWith("/games/");
}
export function shouldShowNavigationAd(previous: string | null, next: string): boolean {
  return previous !== null && previous !== next && isAdNavigationScreen(previous) && isAdNavigationScreen(next);
}

export function adNavigationKey(path: string, chat?: string | string[]): string {
  const chatId = Array.isArray(chat) ? chat[0] : chat;
  return path === "/messages" && chatId ? `${path}?chat=${encodeURIComponent(chatId)}` : path;
}

export function createNavigationAdCounter() {
  let transitions = 0;
  return {
    advance() { transitions += 1; return transitions >= 10; },
    shown() { transitions = Math.max(0, transitions - 10); },
    reset() { transitions = 0; },
  };
}

const profileListeners = new Set<() => void>();
export function reportProfileAdNavigation() { profileListeners.forEach(listener => listener()); }
export function subscribeProfileAdNavigation(listener: () => void) {
  profileListeners.add(listener);
  return () => { profileListeners.delete(listener); };
}
