# Home activity blocks (website)

Replaces only the website's combined challenge/activity panel with the three cards from `previews/home-activity`: a collapsible daily game list and independent weekly/monthly activity reels. Native retains its existing panel through Metro's platform resolution and the `Platform.OS` branch. No APK/OTA publication is involved.

Daily games use the existing `useChallenges` response, cover assets, completion states and `/play/[gameKey]?mode=challenge` route. Hidden game actions are removed from keyboard traversal. Cards use current theme tokens and Russian/Uzbek/English copy. Timers stop while the document is hidden. Reduced-motion disables reel, wave and expansion animations.

## Activity data

New authenticated, read-only `GET /api/v1/activity/home` supplies server time, period boundaries, progress and up to 24 eligible participant previews for each period. No admin data, contact details or tokens are returned. Coins and available balance have the same meaning as public leaderboard values, not promised prizes.

A completed day requires the six distinct games of the published daily set, or a saved contest result with `completedGamesCount: 6`. Repeat attempts and overlapping archived results are deduplicated. Only finished calendar days can be missed. Weekly allowance is two misses; monthly allowance is four, as agreed for the preview. Week starts Monday; periods use the server's challenge timezone (`DEFAULT_TIMEZONE`; current production setting is UTC). Progress remains completed days divided by total days in the period.

The aggregation snapshot is shared for at most 60 seconds, with concurrent requests sharing its promise; an error clears it. Day rollover discards the previous snapshot. User responses are private/no-store. The website refreshes once per minute and after challenge progress changes. Completed-days counters from the existing challenge response can advance the profile immediately.

This endpoint and presentation do **not** modify payouts, scheduled draws, winner selection or eligibility in the separate live-raffle system. They display the agreed activity tracking rules. Those financial workflows remain separate.

The current user is included in the reel when eligible, even outside the bounded server sample, and always retains their own progress card.

No demo people, balances, scenario controls, demo navigation, or fake check-off buttons are shipped. Failures show a retry state, empty lists show an empty state, and guests see a sign-in hint; unknown progress is shown as a dash.

## Validation and release scope

Frontend/backend TypeScript checks; weekly/monthly boundaries and completed-day tests; exported web app browser checks at mobile and desktop sizes, dark/light themes, expand/collapse, rules dialog, keyboard visibility, percentages, reduced motion, and console errors. Browser API fixtures are isolated; no production accounts or prize mutations are used.

Published to logic-coin.online on 2026-11-11 after explicit approval. The additive backend read endpoint and web build were released together from `/srv/apps/logic-coin/staging/home-activity-web-20261111`. Existing production release and withdrawal changes were preserved. Android OTA, DNS, financial writes and draw logic were not changed. The read-only database check passed against production (UTC challenge schedule), and the backend health/authentication gate passed after restarting the API. Rollback copies and guarded deployment metadata remain in the staging directory.
