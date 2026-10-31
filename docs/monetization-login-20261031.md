# Prepared login and ad pacing release — 31 October 2026

Version 1.3.8 / Android code 14. Test installation on the user's paired Mi 10 is authorized. Google Play publication and general OTA/web rollout are not authorized for this release yet.

Changes:
- Google and Telegram appear before email; email guidance and entry copy support Russian, Uzbek and English.
- Official Google brand icon on Android and Google Identity Services button on web. Retry after interrupted/blocked GIS loading; avoid Google automatic prompt during Telegram authentication.
- Android offers the existing SDK's Google account picker once on entry. This is not Credential Manager One Tap; real Google authentication still needs phone verification.
- No immediate App Open ad after authentication. Resume ads require at least 15 minutes in background. Shared 3-minute interval and initial grace for forced full-screen attempts. Voluntary rewarded ads retain their receipts and server verification.
- Release web exports reject missing Google client IDs. CI supplies configured public OAuth identifiers.

Validation:
- TypeScript passed; lint passed with 17 warnings (no errors).
- Full frontend suite: 19 Node tests and 152 Vitest tests passed.
- Isolated Chromium: ru/en/uz provider ordering and GIS failure/retry passed. External APIs, ad networks and Google were mocked; no real ad impressions generated.
- Web preview exported successfully; no public deployment performed.

Remaining:
- Build signed APK/AAB, verify certificate against installed app, install APK without clearing data, and verify native login UI. User must perform actual Google account consent when needed.
- Yandex app-ads.txt personalized seller entries and store developer website still require verification; no seller IDs invented.
- Ad frequency is a conservative starting configuration, not a proven revenue optimum. Measure daily revenue/user and returning players after a separately authorized rollout.
