# Telegram Mini App challenges

2026-11-12: allow daily Challenge games from the Telegram bot's Mini App as well as the installed app. Ordinary website gameplay restriction remains unchanged.

- Both `/challenges` and `/play/:gameKey?mode=challenge` admit the Telegram Mini App UI.
- HTTP challenge requests carry `X-Telegram-Init-Data` for start, complete and double (not only start). Backend uses the existing bot HMAC/auth-date verifier; forged, expired, empty, oversized or malformed launch data is rejected.
- WebSocket authentication retains launch data, and the common eligibility check runs for each command so expiry is not bypassed by a long-lived socket. Account/session authentication remains required. Read/practice/chat operations retain their existing access rules.
- Native client compatibility and gameplay/prize rules are unchanged. No new APK/OTA was needed: this change targets the Telegram web frontend and API.

Validation: backend/frontend TypeScript, web export, 32 backend tests (signed Telegram REST/WebSocket start/complete/double, forged/expired data rejection, native compatibility, ordinary browser restrictions). Browser fixtures at 390px verify Telegram challenge list, actual game host opening, start command and launch-data forwarding; ordinary browser remains blocked. Browser network calls were intercepted: no live attempt, prize or message was created.

Stage `/srv/apps/logic-coin/staging/telegram-challenges-20261112` retains source/web backups and reports. Deployment checks current source and compiled hashes before replacing only changed files, keeps existing web chunks, restarts API with health checks and preserves the current release symlink. No Telegram user launch credentials or bot tokens are stored in fixtures.

Recheck: `npm run test --workspace backend -- --run tests/challenge-client.test.ts tests/challenge-routes.test.ts tests/app-only-websocket.test.ts tests/app-return.test.ts`.

Browser: `TELEGRAM_URL=http://127.0.0.1:8118 node frontend/tests/telegram-challenges-browser.cjs` with an exported frontend served at that URL. This emulates Mini App context; it does not claim physical-device Telegram testing.
