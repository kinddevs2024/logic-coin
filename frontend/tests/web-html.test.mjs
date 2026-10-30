import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizeWebHtml } from "../scripts/finalize-web.mjs";

test("Telegram launch data is read before the SPA entry executes", () => {
  const html = finalizeWebHtml('<html><head><meta name="description" content="Logic Coin"><script src="/entry.js"></script></head><body>App</body></html>');
  assert(html.indexOf('telegram-web-app.js') < html.indexOf('/entry.js'));
  assert(html.includes('<script src="https://telegram.org/js/telegram-web-app.js"></script>'));
  assert(html.includes('<meta name="description" content="Logic Coin">'));
  assert(html.includes('<body>App</body>'));
  assert(!html.includes('libtl.com'));
});
test("repeat builds and older deferred SDK tags do not add duplicates", () => {
  const input = '<html><head></head><body><script defer src="https://telegram.org/js/telegram-web-app.js"></script></body></html>';
  const once = finalizeWebHtml(input);
  assert.equal(finalizeWebHtml(once), once);
  assert.equal(once.match(/telegram-web-app\.js/g).length, 1);
});
test("an invalid export fails instead of silently publishing without initialization", () => {
  assert.throws(() => finalizeWebHtml('<body>App</body>'), /no head/);
});
