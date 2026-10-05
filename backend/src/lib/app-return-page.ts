import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
export function appReturnUrl(origin: string, token?: string): string {
  const url = new URL("/api/v1/auth/app/open", origin);
  // Fragment never reaches access logs, HTTP referrers or the server.
  if (token) url.hash = new URLSearchParams({ telegram_token: token }).toString();
  return url.toString();
}
export const serveAppReturnPage: RequestHandler = (_request, response) => {
  const nonce = randomBytes(18).toString("base64");
  response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` });
  response.type("html").send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Открыть Logic Coin</title>
<style nonce="${nonce}">
body{margin:0;background:radial-gradient(ellipse at 90% 0%,rgba(44,77,128,.35),transparent 40%),linear-gradient(160deg,#101d30,#0b1220 80%);color:#edf3fc;font:15px/22px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100vh;min-height:100svh;display:grid;place-items:center}
main{box-sizing:border-box;width:calc(100% - 40px);max-width:440px;margin:24px 20px;padding:24px;background:rgba(25,39,62,.92);border:1px solid rgba(156,185,225,.2);box-shadow:inset 0 1px 1px rgba(255,255,255,.06);border-radius:24px;text-align:left}
h1{font-size:18px;line-height:23px;font-weight:700;margin:0 0 24px;text-align:center}
a{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:54px;padding:16px 18px;margin:18px 0;border-radius:999px;background:linear-gradient(98deg,#83bbff,#62a0f5);color:#08172d;font-size:14px;line-height:19px;font-weight:600;text-decoration:none;text-align:center}
a:not(#open){background:transparent;color:#edf3fc;margin-bottom:0}
details{margin-top:18px;text-align:left;color:#acbcd3}
summary{display:flex;align-items:center;justify-content:center;gap:12px;cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
.hint{font-size:14px;line-height:1.5}
.info{display:grid;place-items:center;width:26px;height:26px;flex-shrink:0;border:1.5px solid #9bb8e3;border-radius:50%;color:#acbcd3;font-size:17px;font-weight:700}
.help{margin:16px 0 0;padding-top:16px;border-top:1px solid #3c506e;font-size:14px;line-height:1.65}
a:focus-visible,summary:focus-visible{outline:3px solid #b3d4ff;outline-offset:4px;border-radius:12px}
@media(max-width:480px){main{width:calc(100% - 32px);margin:20px 16px;padding:24px}h1{overflow-wrap:anywhere}}
</style></head><body><main><h1>Вернуться в Logic Coin</h1>
<a id="open" href="logiccoin://challenges">Открыть приложение</a>
<a href="https://play.google.com/store/apps/details?id=com.kinddevs.logiccoin" rel="noreferrer">Установить приложение</a>
<details><summary aria-label="Как открыть приложение — показать или скрыть объяснение"><span class="hint">Не открывается приложение?<br>Посмотрите подсказку</span><span class="info" aria-hidden="true">i</span></summary>
<p class="help">Если Telegram не открывает приложение, выберите «Открыть в браузере» в меню ⋮ и снова нажмите «Открыть приложение». Также можно вернуться в уже открытое приложение вручную. Если Logic Coin ещё не установлен, нажмите «Установить приложение».</p></details>
<noscript><p class="help">Откройте приложение вручную.</p></noscript></main>
<script nonce="${nonce}">
(() => {
 const params = new URLSearchParams(location.hash.slice(1));
 const candidate = params.get('telegram_token') || '';
 const token = /^[A-Za-z0-9_-]{32,256}$/.test(candidate) ? candidate : '';
 const route = token ? 'login?telegram_token=' + encodeURIComponent(token) : 'challenges';
 const deep = 'logiccoin://' + route;
 const fallback = location.origin + location.pathname + '?manual=1' + location.hash;
 const intent = 'intent://' + route + '#Intent;scheme=logiccoin;package=com.kinddevs.logiccoin;S.browser_fallback_url=' + encodeURIComponent(fallback) + ';end';
 const android = /Android/i.test(navigator.userAgent);
 document.getElementById('open').href = android ? intent : deep;
 // Browsers can require a user gesture. Never fall back to web authentication.
 if (android && !new URLSearchParams(location.search).has('manual')) {
   try { location.assign(intent); } catch (_) { /* keep explicit buttons */ }
 }
})();
</script></body></html>`);
};
