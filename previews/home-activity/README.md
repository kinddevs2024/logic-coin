# Home activity preview

Standalone, read-only design preview at `/home-preview/`. It contains three
separate cards: today's six games, weekly activity, and monthly activity.
The daily card starts partially collapsed with an opacity mask and expansion
button. The mask reaches full transparency before the clip boundary, avoiding
a visible cutoff against the translucent card in either theme.
Each heading has a single compact clock at the right. Activity cards contain
a vertical sample participant reel with edge fades,
followed by the viewer's profile. Progress is the percentage of completed days
in the full period, shown as water filling the profile behind its text, with
continuous small waves. There are no separate status badges, day bars or footer
notes. A short exclusion state appears inside the profile only when needed;
the viewer leaves the reel when the miss limit is exceeded. Rules remain under
the information icon. Scenario controls are collapsed below the preview.

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
The duplicated participant reel loops seamlessly. Reel and water animations
respect reduced motion and pause when the page is hidden. This route
is marked noindex and has a CSP prohibiting API connections.
