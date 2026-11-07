# Telegram advertising startup fix (2026-10-30)

The deployed single-page Expo HTML did not include the official Telegram WebApp SDK. The +html.tsx declaration is not rendered by single-page exports. Loading that SDK later from AdRuntime could happen after the router had replaced Telegram launch parameters, leaving platform detection false and the rewarded provider unavailable. Website display tags could consequently be loaded inside the Mini App.

Added a deterministic post-export finalizer that inserts one blocking official Telegram WebApp script at the beginning of head, before app entry scripts. The SDK reads genuine launch parameters before router navigation. Monetag itself remains restricted by isTelegramMiniApp; no Telegram identity is fabricated and no TMA ad calls are enabled for ordinary browsers. npm build:web and CI now run the finalizer.

Published the HTML fix atomically on the existing web export. Verified the early script and release marker on all three production origins. Backups: /srv/apps/logic-coin/backups/telegram-ads-fix-20261030/index.html. Release marker: 20261030-telegram-sdk. Backend reward confirmation and APK binaries unchanged.

Validation: three HTML tests passed (entry order, idempotence/deduplication, invalid export), ten existing provider/isolation tests passed. Isolated browser tests mocked Telegram and ad scripts: Telegram launch initialized platform android before rendering, loaded zone 12150927 once, and retained context after hash removal; ordinary browser loaded no Monetag TMA SDK. Zero browser exceptions. This does not verify live ad fill on the user's phone.

Read-only production session aggregation confirmed MONETAG_POSTBACK_SECRET is configured and successful Monetag fortune/home-gift claims exist. Some sessions also expire, so missing inventory/network errors remain possible. Reopen the Telegram Mini App completely to load the new document before phone validation.
