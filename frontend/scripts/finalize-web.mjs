import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const telegramSdk = '<script src="https://telegram.org/js/telegram-web-app.js"></script>';

export function finalizeWebHtml(html) {
  if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error("Exported HTML has no head");
  // Single-page Expo exports do not render +html.tsx. The official Telegram
  // SDK must read real launch parameters before the router changes the URL.
  // This does not load Monetag on the ordinary website or fabricate initData.
  return html
    .replace(/\s*<script\b[^>]*\bsrc=["']https:\/\/telegram\.org\/js\/telegram-web-app\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n${telegramSdk}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = resolve(process.argv[2] ?? "dist", "index.html");
  await writeFile(file, finalizeWebHtml(await readFile(file, "utf8")), "utf8");
  console.log("Telegram SDK initialized before the exported app entry");
}
