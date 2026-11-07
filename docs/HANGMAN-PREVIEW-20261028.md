# Hangman preview — 2026-10-28

The unpublished Tower and Find the Pair preview implementations were removed. Their original transfer archive and the server's `games-before-hangman.tgz` preserve recovery copies.

## Preview

- Server: `173.212.216.216`, process `logic-games-expo` managed by PM2.
- Isolated source: `/srv/apps/logic-coin/diagnostics/games-preview-20261028/frontend`.
- Expo Go: `exps://logic-preview.173.212.216.216.sslip.io/--/preview-games`.
- HTTPS Metro proxy uses the existing preview virtual host and loopback `[::1]:8083`; the original `/api/` location is preserved. Nginx configuration backup: `/srv/apps/logic-coin/diagnostics/logic-preview-before-hangman.conf`.
- Preview starter hints are stored locally, once per account identity, shared across languages. They are isolated from live gifts and wallets.
- Production backend, mobile-current, website, APK/AAB and signed OTA were not released or replaced.

## Rules

One challenge contains three words. Solving them without mistakes awards 333 + 333 + 334 = 1000 coins. Each distinct incorrect letter subtracts 3 coins from that word. An unsolved word awards zero. Repeated guesses do not deduct again. Seven incorrect guesses end the word, then the next word is available. Repeated occurrences of a correct letter reveal together. Gift hints reveal a correct letter, without charging coins. The backend Hangman scoring branch caps submitted rewards at 1000.

The game reads Russian, Uzbek or English from the application's language setting. Each language has its own keyboard and word set. Challenge words rotate by UTC day; practice previews retain progress locally. Backgrounding pauses input/audio and duration counting. Practice can restart; challenge restart is disabled so mistakes cannot be erased by restarting the view.

## Prepared account integration — not deployed

The candidate source registers Hangman in both catalogs and the existing play host. `POST /gifts/hints/starter` checks for a started Hangman challenge and grants exactly three single-use gifts using immutable, account-scoped source IDs. Reloading, changing language and using gifts do not replenish them. The unique source ID index and transaction protect concurrent first-entry requests.

The shared gift inventory supports `kind: hint`. Challenge random gifts can contain one hint. The hint game capability registry currently contains Hangman; another game must implement its own hint action before being added. Gifts are consumed by ownership-checked, conditional updates in the existing transaction. There is no purchase or advertisement grant path for hints.

This backend source is included in the candidate archive only. It must be released separately before real accounts receive starter or challenge hint gifts. The current Expo preview deliberately uses its isolated starter inventory.

## Verification

- Frontend typecheck and ESLint passed; backend typecheck passed.
- 8 frontend tests: Hangman rules and existing reward calibration.
- 20 backend tests: gift ownership/consumption, starter grant idempotency and prerequisites, contest rewards, Hangman hard cap.
- Browser: first screen in all three languages, full three-word challenge ending at 1000/1000, hint stock 3 to 2, and pause panel.
- External Android manifest and full bundle: HTTP 200; Hangman present; TowerGame and PairGame absent.
- Native phone interaction and sound output still require user testing in Expo Go.

Font licenses are bundled beside the assets. Latin uses Shadows Into Light Two; Cyrillic uses Neucha. Generated raster paper and illustrations are used rather than code-drawn image substitutes.
