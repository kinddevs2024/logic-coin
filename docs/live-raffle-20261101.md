# Live raffle release — 1 November 2026

Delivered admin page `/admin/raffle`, player page `/raffle`, home countdown after the savings bank, and a global full-screen event layer. Drafts are hidden. Publishing arms the scheduled event; on the event day the home card appears, and the administrator-selected 1–30 minute lock window opens the countdown. At the scheduled time the live stage opens. Each prize round starts separately from the admin panel. Ending/cancelling releases the full-screen layer; a spinning round must settle first.

## Rules and prizes

- Authenticated regular users need attendance on six distinct dates in the last seven Tashkent calendar days, including today. Existing `CoinRewardLogin` attendance is reused; multiple launches do not create additional active days.
- Foreground presence is refreshed every ten seconds with a twenty-second grace window. Sessions are tracked independently; one closing device cannot remove another online session. Inactive tabs/background apps stop participating. Eligibility is re-read inside each draw transaction.
- The server selects uniformly with Node crypto, freezes the full eligible pool and selected user in a private `RaffleDrawAudit` record, and exposes no winner until settlement. The visual avatar reel is a compact preview; the full pool participates, including players outside that preview. Separate audit documents keep multi-round event documents bounded.
- Up to fifty configured rounds, each with its own cash/physical description and 5–180 second duration. Repeat winners are excluded by default and can be enabled explicitly. Cash is credited directly to the existing wallet; integer units are cents. A unique ledger source and Mongo transaction prevent duplicate payments. Physical awards record the winner and description without creating money.
- Everyone watching receives the winner dialog. The winning account receives the particle celebration. Winner names remain available in admin history. Current games pause during the full-screen event. App-open advertisements are suppressed during it.

## YouTube and delivery

The admin supplies a normal HTTPS YouTube watch/live/share URL and can preview it before publication. The stream uses the official embedded player: https://developers.google.com/youtube/player_parameters. Native Android WebView is present in the new APK. Older APKs safely show an update/download link instead of importing an unavailable native component. Actual playback depends on the supplied video allowing embedding; a real customer live stream was not supplied or tested. Playback may require tapping the player.

Raffle push events cover the event-day announcement, start, spins, winners and ending. Countdown notices occur at 60/50/40/30/20/10 seconds and each second from nine to one. Expiring countdown pushes are omitted from the persistent inbox and carry short delivery TTLs. OS/provider delivery can be delayed or throttled; the in-app countdown uses server time. Notification permissions/preferences remain respected. The scheduled worker connects to MongoDB on cold startup without waiting for a visitor.

A stale disconnected event layer releases after ninety seconds without a successful state refresh, and the server-side lock has a two-hour failsafe. The administrator remains outside the forced viewer layer.

## Published artifacts and verification

- APK/AAB version 1.3.9, code 15; native runtime `9192d900a55c3b21711e36db40294437a0dc47d6`.
- Native build run `41245515612`, source `8ed11ec`. APK signer SHA-256 `85da6343aa98cddb89a8090dadfff7525441ba5cd97503e429f5074fd16e3822`, matching the preceding installed builds. APK/AAB checksums and the presence of the native WebView were verified. Signed downloads were fetched publicly and their SHA-256 values matched.
- Web/JavaScript release run `41247855992`, source `b15845a106459df6edd4258ba9373414533d4ada`. Additional backend cold-start fix is commit `675d076`, compiled and tested separately.
- Shared website, backend and all sixteen registered compatible Android channel/runtime targets were published. Every prior target used SDK 57 and matched the new Hermes bytecode header. Signed manifests and 174 unique public resource URLs were verified. A valid unknown runtime receives HTTP 204. This is not physical-device verification of every old APK.
- Public website origins verified: logic-coin.online, www.logic-coin.online, and logic-coin.173.212.216.216.sslip.io. API health reports a connected database; the PM2 process directory resolves to the new release.
- Frontend CI typecheck/lint, 170 Vitest tests and Node smoke suites passed. Backend CI typecheck and 195 tests passed; seventeen pre-existing optional integration tests remain skipped. The final backend boot fix also underwent the backend suite and isolated replica-set integration.
- Isolated integration verified six distinct days, offline exclusion, multiple sessions, concurrent spin exclusion, hidden pre-settlement winner, a single cash credit under repeated settlement, physical awards without money, repeat-winner exclusion, authorization, ending/unlocking, bounded snapshots, full-pool audit and cold-start database connection. No test users or prizes were created in production.
- Isolated browser checks passed for RU/UZ/EN countdown/live/winner/end flows. Admin UI checks covered Tashkent time conversion, multiple cash/physical rounds, explicit publication confirmation and disabling premature spins. YouTube was mocked in these UI checks; no advertising impressions or live broadcasts were generated.

## Operations and recovery

Production release: `/srv/apps/logic-coin/staging/raffle-b15845a-20261101`. Metadata records the component revisions. Sources, compiled server and web export remain inspectable in that release. Unchanged hashed web assets were retained for already-open browsers. Existing ads.txt/app-ads.txt were preserved.

Backup: `/srv/apps/logic-coin/backups/raffle-20261101`. `release-before.json` records the previous production pointer; `ota-before.json` and attempt snapshots record earlier OTA configurations. Rollback of signed updates republishes prior content with a fresh timestamp. The first publishing pass automatically reverted when its unknown-runtime probe omitted the required protocol header; the corrected probe and final full rollout passed.

No real raffle was scheduled, published or spun, no event broadcast was sent, and nothing was submitted to Google Play. The administrator must create and publish the actual schedule and supply the live YouTube URL. Temporary preview servers, SSH forwards and the isolated MongoDB test server were stopped; its scratch data was removed.

Downloads:
- https://logic-coin.online/downloads/logic-coin-1.3.9.apk
- https://logic-coin.online/downloads/logic-coin-1.3.9.aab
