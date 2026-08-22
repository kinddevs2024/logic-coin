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
