# Logic Coin design QA — 18 browser annotations

- Source visual truth: the 18 annotated browser screenshots supplied in the active task, including the 434 x 881 home, games, profile, challenge-result, and One Second states.
- Supporting source capture: `C:\Users\MyPc\Documents\Logic-coin\.qa\one-second-source.png`
- Implementation: `http://127.0.0.1:8081`
- Supporting implementation capture: `C:\Users\MyPc\Documents\Logic-coin\.qa\one-second-production-final.png`
- Viewports checked: 434 x 881 mobile and 1280 x 720 desktop.
- States checked: home, games catalog, profile, profile editor, profile drawer, One Second intro and active practice round.

## Visual comparison

The updated mobile home preserves the supplied jar/island composition and uses the six transparent `jar-state` assets. The leaderboard is centered between profile and settings with stacked avatars; the balance bubble is smaller and has no blue dot. The activity counters are present below the challenge list.

The games catalog has no obsolete subtitle, shows the global coin balance in its header, uses circular image covers, and exposes an explicit `Играть` button on every card. The profile has no language chip or active-days card, keeps edit as an icon-only action, and shows balance, coin, friends, games today, and monthly challenge participation. The side drawer is narrower, has no close button, closes through the backdrop, links to settings, and places the edit and share actions together in the identity card.

The One Second practice intro states `Без ограничений`; its active HUD shows an infinite attempt counter. Game shells retain the dark arcade art direction while decorative ambience now drifts slowly with blur and honours reduced-motion preferences.

## Functional and fidelity checks

- Coin presentation: result and HUD surfaces use coin terminology; raw score remains internal only for game logic and server validation.
- Reward cap: shared frontend and backend reward contracts cap each game's total coin reward at 1000, including the game-level double path.
- Statistics: authenticated `игр сегодня` counts all completed practice and challenge attempts; monthly participation includes started and completed challenge days.
- Avatar flow: file picker accepts JPG, PNG, or WebP up to 10 MB, requests a square crop/edit step, and saves a data URL instead of a remote avatar URL.
- Challenge configuration: One Second attempt count is configurable from admin from 1 to 100; practice remains unlimited.
- Navigation: tab scenes use fade/shift transitions; the Liquid Glass bar has a moving active pill, glass highlight, soft border/shadow, and a non-black keyboard focus ring.
- Public profile: referral-code URLs expose the user's winnings, money balance, coin balance, and purchased skins.
- Asset integrity: all 20 catalog entries resolve to real local WebP covers; the removed Gold Rush entry is absent.
- Browser console: no application errors were present on the checked production pages. One unrelated Google Identity warning can occur after repeated local login reloads.

## Comparison history

### Pass 1

- P1: the jar had been replaced with the wrong bank artwork.
- P1: result screens mixed raw points and coin rewards.
- P2: active tab retained a black browser focus outline.
- P2: profile/editor and catalog controls did not match the annotated requirements.

### Pass 2

- Restored the six original transparent jar states and verified the 64% filled state on the home screen.
- Unified visible game metrics and rewards as coin and enforced the 1000 cap.
- Replaced the black tab outline with a soft accessible focus-visible glow.
- Verified the corrected catalog, profile, profile editor, drawer, counters, and One Second practice flow.
- No remaining P0, P1, or P2 visual issues were found in the checked states.

### Pass 3

- Moved the profile edit action into the upper-right action group of the blue identity card, immediately left of the share action.
- Removed the detached edit control below the statistics cards and reserved horizontal room so long account names do not collide with the two actions.

final result: passed

### Pass 4 — optical lens and drag fidelity

- Re-measured the supplied iPhone reference against the live 434 x 881 layout: the lens now exceeds the bar height slightly and spans 1.23 tab slots.
- Removed the displaced partial chroma circle and the sharp cyan top/bottom strips.
- Applied refraction to the complete lens, with a softer magnifying edge, neutral glass rim, centered glint, and increased distortion while the pointer is moving.
- Verified real drag navigation from Home to Games, Games to Challenges, and Challenges to Profile; every release snapped to the nearest destination and changed the route.
- Cleared pointer focus after drag so the previous tab no longer retains a browser outline, while keyboard focus-visible behavior remains intact.
- TypeScript, scoped strict ESLint, and the production Expo web export pass after the final optical changes.

final result: passed

## 2026-08-22 Liquid Glass navigation lens

- Source visual truth: `C:\Users\MyPc\Downloads\70f040ec76bbd15f8eae1b1aaaf9669f.mp4`, 1600 x 1200, 3.45 seconds.
- Reference capture: `C:\Users\MyPc\Documents\Logic-coin\.qa\liquid-nav-reference.png`.
- Mobile implementation capture: `C:\Users\MyPc\Documents\Logic-coin\.qa\liquid-nav-mobile-final.png`, checked at 434 x 881.
- Desktop implementation capture: `C:\Users\MyPc\Documents\Logic-coin\.qa\liquid-nav-desktop-final.png`, checked at 1280 x 800.
- The active item is one shared frosted lens rather than four separate selected backgrounds. It moves with a spring, briefly stretches in the travel direction, returns to a circular pill, and honours reduced-motion preferences.
- The lens reproduces the reference hierarchy with a bright glass glint, soft depth, pastel magenta/cyan refraction rim, magnified active icon/label, and low-contrast inactive destinations.
- The same interaction changes axis responsively: horizontal on phones/tablets and vertical in the desktop rail.
- All four destinations were exercised in both layouts. The final browser error log was empty and no overlap, clipping, harsh shadow, or unsafe touch target remained.
- TypeScript, strict Expo ESLint, and the production Expo web export pass.

final result: passed

### Pass 5 — perimeter refraction ring

- Source visual truth: `C:\Users\MyPc\Documents\Logic-coin\.qa\liquid-nav-reference.png` at 578 x 881 pixels, density 1.
- Browser implementation: `C:\Users\MyPc\Documents\Logic-coin\.qa\liquid-nav-edge-static.png` at a 460 x 881 CSS viewport, density 1; focused interaction state was also captured during the Challenges-to-Games drag.
- Full-view comparison: bar hierarchy, lens proportion, active icon magnification, soft elevation, and low-contrast inactive destinations remain aligned with the reference. The implementation intentionally keeps Logic Coin icons and labels.
- Focused-region comparison: the edge is now a real 5 px masked backdrop filter around the entire lens. The former one-sided cyan tint and center-wide blur are absent; the blue halo is uniform and lower intensity as requested.
- Interaction evidence: a real pointer drag from Challenges to Games retained the masked edge and snapped to `/games` after release.
- Typography, spacing, app imagery, and copy outside the annotated lens were unchanged in this scoped pass.
- TypeScript, scoped strict ESLint, and the production Expo web export pass.

final result: passed

### Pass 6 — soft full-circumference halo

- User feedback rejected the hard 5 px masked perimeter from Pass 5 and selected the softer pre-mask lens as the visual baseline.
- Removed the CSS mask and the masked edge node completely; computed browser styles now report `mask-image: none` and no `#liquid-edge-refraction` element.
- Restored full-lens 7 px refraction during motion and replaced the one-sided blue tint with a low-opacity, zero-offset halo distributed evenly around the complete pill.
- Softened the internal blue edge with a 4 px blur and no border, padding, or directional shadow, so there is no visible ring boundary or top/bottom strip.
- Compared `C:\Users\MyPc\Documents\Logic-coin\.qa\liquid-nav-reference.png` and `C:\Users\MyPc\Documents\Logic-coin\.qa\liquid-nav-soft-halo-final.png` in one visual pass.
- Verified a real drag from Games to Challenges: the lens followed the pointer, snapped to the destination, and the route changed to `/challenges`.
- TypeScript, scoped strict ESLint, and the production Expo web export pass.

final result: passed

### Pass 7 — stickered seven-state savings jar

- Created and pushed the pre-change checkpoint `9a3d684` on `agent/auth-games-redesign` before replacing the savings artwork.
- Replaced the scene source list with the supplied `1-Photoroom.png` through `7-Photoroom.png` files in strict ascending fill order and mapped progress across all seven states.
- Removed the detached balance bubble. The formatted wallet value now moves with the jar and is centered on the beige paper label embedded in every source image.
- Increased the jar presentation to a 340 px square stage while preserving the existing island, contact shadow, ambient drift, and reward-drop layers.
- Source comparison: `C:\Users\MyPc\Documents\Logic-coin\frontend\assets\scene\6-Photoroom.png`.
- Implementation composition: `C:\Users\MyPc\Documents\Logic-coin\.qa\jar-sticker-balance-final.png`; `$6.40` remains centered, legible, and contained inside the label with no clipping or collision.
- The browser error log for the checked composition is empty. TypeScript, scoped strict ESLint, and the production Expo web export pass.

final result: passed

### Pass 8 — jar elevation and label optical centering

- Source visual truth: `C:\Users\MyPc\AppData\Local\Temp\codex-clipboard-522347d1-a6b9-40e3-8d6e-96006f92f7a2.png`, 441 x 592 px, showing the `$6.40` sixth jar state.
- Revised browser render: `C:\Users\MyPc\Documents\Logic-coin\.qa\jar-position-label-final-full.png`, 469 x 881 px at a 469 x 881 CSS viewport and device density 1. The source is a cropped higher-density app capture, so focused composition was normalized by jar, sticker, grass, and island proportions rather than raw pixels.
- Earlier P2 layout finding: the jar bottom covered the central grass and weakened the visual contact with the island. Fix: moved the entire jar group 16 px upward and moved the reward-drop slot target by the same amount.
- Earlier P2 typography finding: the balance sat above the optical center of the paper label and was undersized. Fix: moved the label center 7 px downward, preserved its horizontal center, expanded the text box from 108 px to 120 px, and increased type from 21/25 to 24/29.
- Post-fix focused evidence: the grass line now remains visible beneath the jar, the jar still meets the island without a floating gap, and `$6.40` is centered within the beige sticker with comfortable side clearance.
- Fidelity surfaces: typography uses the existing app family and weight; spacing and vertical rhythm are corrected without changing scene dimensions; colors and tokens are unchanged; all supplied raster assets retain their original sharpness and transparency; copy remains the formatted wallet value.
- Browser console errors: none. No additional interaction behavior changed.

final result: passed

### Pass 9 — tall leaderboard sheet and animated metric switcher

- User visual direction: the leaderboard must mirror the profile drawer interaction but rise from the bottom, leave roughly 200 px of the home scene visible, and close only from the empty backdrop.
- Before/after comparison: `C:\Users\MyPc\Documents\Logic-coin\.qa\leaderboard-bottom-sheet-final.png` and `C:\Users\MyPc\Documents\Logic-coin\.qa\leaderboard-bottom-sheet-tall-final.png` were inspected together at the same mobile viewport.
- Earlier P2 layout finding: content-sized rendering left roughly half the screen uncovered. Fix: the glass sheet now occupies 78% of the viewport, is bottom-anchored, and keeps the existing 720 px tablet/desktop cap.
- Earlier P2 control finding: the compact home action lost the people decoration when its label was removed. Fix: restored a three-avatar stack with the trophy while keeping the visible `Рейтинг` text removed and the accessible name intact.
- The metric order remains `Все`, `Деньги`, `Coin`. A single raised glass selection pill now springs horizontally between the three slots; the table content follows with a restrained directional fade/slide and respects reduced-motion preferences.
- Verified both animation directions in the running web build. Switching filters keeps the sheet open; pressing the unobstructed backdrop closes it; the browser console remains clear.
- TypeScript, scoped strict ESLint, and the production Expo web export pass.

final result: passed

### Pass 10 — unified email authentication and mobile admin entry

- The regular login screen now branches after email discovery: verified accounts with a password see a password field; new accounts and legacy accounts without a password continue through the six-digit email code and a dedicated create-password screen.
- The password setup screen preserves the existing minimal auth scaffold, uses one secure password field as requested, and keeps an accessible back action and eight-character validation.
- Administrator access now starts from the same login screen and uses the regular user session with an `admin` role. The former standalone `/admin` password card and dedicated admin token flow are removed.
- Browser evidence: `C:\Users\MyPc\Documents\Logic-coin\.qa\admin-regular-login-mobile-final.png` at the active mobile viewport. The header, horizontal admin navigation, live analytics title, refresh action, and first metric cards are visible without the former empty vertical gap.
- The authenticated admin flow was exercised end to end against the connected database: regular login redirected to `/admin`, and the overview rendered live values from the API.
- Local Vercel Analytics script warnings are expected outside Vercel; no application runtime errors were logged.

final result: passed

### Pass 11 — budget controls, challenge settlement, and card withdrawal

- Source visual truth: the three annotated mobile browser captures supplied on 23 August 2026 for `/admin/budget`, `/admin/challenges`, and `/withdraw`, plus the supplied Untitled UI credit-card and checkbox examples.
- The budget grid keeps the existing white Liquid Glass card system. The former growth tile is now `Общий бюджет`, with a compact edit action in its upper corner and a native add/subtract sheet that remains usable at the 379 x 769 mobile viewport.
- The challenge editor keeps all primary actions full-width on phones. Immediate settlement now uses an explicit confirmation panel instead of a browser alert; save, publish, and calculate controls no longer compete for one row. A published challenge records a fixed 24-hour end time and is lazily settled on the first API access after expiry.
- The eligible withdrawal state uses one real interactive card surface rather than detached inputs. Card number, holder, and expiry remain aligned inside the card; Visa and Mastercard are detected from the number, while unknown brands fall back to `CARD`.
- Security comparison: the client validates the full number in memory, but only brand, holder, expiry, and last four digits cross the API boundary. CVC is not requested or persisted. Remember-card persistence uses the same truncated fields.
- Agreement implementation: `C:\Users\MyPc\Documents\Logic-coin\.qa\withdrawal-agreement-mobile.png`, checked at the active mobile viewport. The separate document preserves the app typography and glass surfaces, explains the 12-hour review target, and remains vertically scrollable without horizontal clipping.
- Functional verification: backend TypeScript, production build, and 21 test files / 53 tests pass; frontend TypeScript, Expo lint, 3 smoke tests, and 18 Vitest checks pass. QA did not submit a real withdrawal, change the platform budget, or settle the live challenge.

final result: passed

### Pass 12 — desktop Google Play handoff

- Source asset: `C:\Users\MyPc\Documents\Logic-coin\frontend\assets\store\google-play-ru.png`, the official Russian Google Play badge downloaded from Google's badge CDN.
- The badge is rendered only at the existing desktop navigation breakpoint and is anchored below the vertical Liquid Glass navigation rail; mobile and native layouts remain unchanged.
- The complete badge is preserved at its native aspect ratio with no redraw, cropping, or substituted icon. Its accessible label identifies Logic Coin and the link opens the package listing `com.kinddevs.logiccoin` in a new browser tab.
- Production export evidence: the built web bundle contains both the exact Play Store URL and the hashed local badge asset. Frontend TypeScript, Expo lint, smoke tests, Vitest, and the production web export pass.

final result: passed
