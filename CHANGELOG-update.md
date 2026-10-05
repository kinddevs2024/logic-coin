# APK update work in progress — 2026-10-04

Based on a fresh copy of the running production source. All work is isolated in this directory; production and existing user balances are unchanged.

## Implemented

- Compact challenge ranking: rank and actual name, no coin count.
- Challenge counter displays the whole fund; question-mark explanation retained.
- Tapping the active summary opens metrics, game rewards, and paginated ranking starting at the top.
- Save game results before automatic, non-rewarded interstitials. Do not grant coins for these ads.
- Fortune animation uses stable completion callbacks and stops at the selected reward. Existing rewards remain +50/+150/+200/+500/+1000; labels show their actual fixed amounts, not misleading multipliers.
- Base game formula: 500–1000 coins. Daily challenge base credits capped at 6000 inside the database transaction. Authorized replay bonuses and fortune are separate.
- Reduced geography, letter, and number round budgets; added three-minute timeouts to VOLT Numbers, Pulse, One Second, and Strike. Expanded One Second to 40 attempts and Strike challenges to 38 hits to target ordinary sessions around 1–3 minutes. Corrected VOLT Numbers millisecond/second scoring error.
- Expo Go does not load unsupported native Google/Appodeal/AdMob SDKs and never simulates completed ads or credits.
- Added missing QR, localization, image-crop, and type dependencies required by the retrieved source.

## Not yet release-ready

- End-to-end native ad/fortune verification and matching server deployment are required. The preview API still uses the unchanged production backend, so its payouts do not yet use these new rules.
- Classic puzzle/practice games still require a separate duration/balance pass; not every game is yet guaranteed to last 1–3 minutes. Fast answers and early defeats can also finish before a minute.
- Full backend suite includes failing device/publication/leaderboard tests and skipped database integration tests. Targeted passing tests are not a substitute for all integration coverage.
- Expo preview does not establish a successful physical-device test or signed APK build.

## Checks

Frontend: 65 unit tests and 3 smoke tests passed on repeated runs. Both final TypeScript checks passed. Backend first run: 122 passed, 6 failed, 17 skipped; targeted tests: 14 passed; new mocked base-cap tests: 3 passed. Build/visual verification and release boundaries are tracked separately in design-qa.md.
