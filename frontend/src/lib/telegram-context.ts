// UI routing only: authentication must still validate initData on the server.
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  const app = (window as Window & { Telegram?: { WebApp?: { initData?: string; platform?: string } } }).Telegram?.WebApp;
  return Boolean(app?.initData || (app?.platform && app.platform !== "unknown") ||
    /(?:^|[?#&])tgWebApp(?:Data|Platform|Version)=/.test(window.location.hash + window.location.search));
}
