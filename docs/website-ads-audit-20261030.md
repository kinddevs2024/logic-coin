# Website challenge and advertising audit (2026-10-30)

Status: released as 20261030-web-challenges. Website Vignette zone 12151182 uses the tag supplied from Monetag. AdSense account approval is still pending; configured slots are not guaranteed impressions.

## Existing APK placements

| Trigger | Requests / placements |
| --- | --- |
| Launch or return to foreground | One app-open request, native minimum interval 120 seconds |
| Completed game | One interstitial request |
| Standard challenge result | One Appodeal banner |
| Fortune, replay, doubling, third-game bonus | One optional rewarded request for each accepted action |
| Home timed gift | Two rewarded requests for one gift claim |
| Challenge ad offer | One optional rewarded request, Android only, server cooldown applies |

Provider fallback does not count as a second successful ad. Dormant AdMob components do not count. The paper Hangman result differs from the standard challenge result. Counts depend on the actions taken, provider fill and availability, so there is no fixed total per user session.

## Website inventory and proposed comparison

The home page already has three AdSense placements and Monetag In-Page Push zone 11951825 (verified for www.logic-coin.online). The Telegram Mini App SDK zone 12150927 is separate and must remain Telegram-only.

For the standard challenge result, the APK has two configured opportunities: interstitial and banner. The website proposal has two display slots plus In-Page Push and Vignette, four configured formats/placements. This is an inventory comparison, not a promise of twice as many impressions. Monetag scripts must be inserted once per zone and their own frequency controls respected. In-Page Push and Vignette do not necessarily produce a fresh impression after every game. Do not claim 24 real impressions for a six-game challenge.

The two website result slots use existing AdSense inventory 8329614753 and 3467995303. They may remain unfilled until approval. No ad click, generic script load, or ordinary display impression grants coins. Rewarded payouts still require the existing verified reward flow.

## Challenge changes and validation

Remove browser-only gates in the challenge screen, game route, REST commands and WebSocket commands. Keep authentication, input validation, rate limits, server attempt validation and reward limits. Browser command acceptance is covered by REST and real WebSocket transport tests. Backend suite: 179 passed, 17 skipped; backend TypeScript build passed.

Release evidence: backend TypeScript build and frontend typecheck passed; lint has zero errors (18 existing warnings). Targeted suites passed: 10 advertising tests and 14 REST/WebSocket tests, including rejection of unauthenticated browser commands. Expo export required --clear to discard an older router bundle. Production health is 200, unauthenticated browser start is 401. All three public origins serve the release and nine entry assets were checked. Backups: /srv/apps/logic-coin/backups/web-challenges-20261030; previous web symlink target is recorded in web.json. Telegram rewarded SDK and secret postback configuration remain separate.

Browser verification of the exported release: 390x844 and 1365x844, a ten-attempt One Second challenge completed locally, both result slots present, each Monetag tag present once, next-game control visible after scrolling, authenticated challenge page accessible, zero browser exceptions. Ad networks and account data were mocked to avoid generating paid impressions or modifying a real user attempt. Real browser-account reward payout was not exercised.
