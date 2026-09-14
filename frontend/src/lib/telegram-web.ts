export type TelegramWebApp = { initData?: string; ready?: () => void; expand?: () => void };
let loading: Promise<TelegramWebApp | undefined> | undefined;
export function loadTelegramWebApp(): Promise<TelegramWebApp | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  const current = () => (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  if (current()) return Promise.resolve(current());
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://telegram.org/js/telegram-web-app.js"]');
    const script = existing ?? document.createElement("script");
    const finish = () => { clearTimeout(timeout); script.removeEventListener("load", finish); script.removeEventListener("error", finish); resolve(current()); };
    const timeout = setTimeout(finish, 8_000);
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", finish, { once: true });
    if (!existing) { script.src = "https://telegram.org/js/telegram-web-app.js"; script.async = true; document.head.appendChild(script); }
  });
  return loading;
}
