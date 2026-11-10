# Home activity preview

Standalone, read-only design preview at `/home-preview/`. It contains three
separate cards: today's six games, weekly activity, and monthly activity.
The daily card starts partially collapsed with a gradient and expansion button.
Activity cards show period-end countdowns, completed days, a rotating sample
participant pool, and the viewer's profile. The viewer leaves a pool when its
miss limit is exceeded; the card and history remain visible with a next step.

Approved proposal: up to two missed days per calendar week, exclusion after the
third; up to four per calendar month, exclusion after the fifth. Misses are
cumulative within a period. A day counts after all six games are complete.
Today is not a miss until midnight in Asia/Tashkent. Weeks start on Monday;
months start on the first. Each period resets independently. Finishing later
games cannot erase earlier missed days or restore eligibility in that period.

All participants and game states are demonstrative. Scenario controls cover both
limits, each exclusion, the first day, and a new week. A next-day button allows
walking through the transitions. Completing sample games changes only in-page
state. The preview makes no API requests, reads no authentication state and
changes neither homepage code nor server raffle eligibility. Existing production
rules are not replaced by this prototype.

The deployment adds only an isolated Nginx location and static assets; no app
release, Android OTA update, backend restart or database migration is needed.
Production financial and raffle logic remains outside this preview.

## Local validation

Run `npm test` here for seven date, grace-limit, rollover and history checks.
Serve `public/` with `python -m http.server 8094 --bind 127.0.0.1 --directory public`.
With Playwright/Chromium installed, run `node tests/browser.cjs` for interaction,
accessibility-state, 320/360/471-pixel layout, theme and network-isolation checks.
Set `PREVIEW_URL` to check the published URL instead. No package install is
required for the pure calculations or static site.

Source assets are the application's own game covers and icon. Participant avatars
are sample initials using the existing light blue, green, yellow and red palette.
Animation respects reduced motion and pauses when the page is hidden. This route
is marked noindex and has a CSP prohibiting API connections.
