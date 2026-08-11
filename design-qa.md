# Logic Coin Liquid Glass design QA

## Source and implementation

- source reference: `C:\Users\MyPc\AppData\Local\Temp\codex-clipboard-c1399606-c445-479e-888d-b91fa246c4dc.png`
- implementation route: `http://127.0.0.1:8081/`
- browser: Chrome
- viewport: 390 × 844 CSS pixels, DPR 1
- state: Russian, light theme, guest mode, balance `$6.40`
- implementation capture: `design-qa/home-mobile-390x844-final.png`
- full comparison: `design-qa/comparison-final.png`
- focused hero comparison: `design-qa/comparison-hero.png`

## Comparison history

### Pass 1

- P1: copied JPEG jar assets produced a visible pale rectangle over the animated background.
- P2: fixed-width scene could overflow on narrow 320 px devices.
- P2: some task and chip touch targets were under 44 px.

### Pass 2

- P1: contrast and blend-mode compensation removed too much of the glass jar and left the contents visually floating.
- P2: inactive tab screens kept ambient animation loops alive.
- P2: web glass surfaces applied backdrop blur twice.

### Final pass

- Replaced the opaque jar presentation with a transparent jar shell and separate clipped fill layer built from the supplied coin and bill assets.
- The final hero preserves the reference hierarchy: two top controls, balance, jar on island, two CTAs, task panel, and bottom navigation.
- The final mobile frame has no visible rectangular asset backgrounds, accidental clipping, broken radii, or unsafe overlaps.
- The third task truncates intentionally at the 390 px viewport and remains understandable with its reward and action visible.
- Profile drawer, theme change, language change, task reward, and navigation states were verified interactively.
- A fresh static-production tab was reloaded after the hydration fix with no browser warnings or errors.
- No remaining P0, P1, or P2 visual issues were found.

previous result: passed

## 2026-07-29 targeted Liquid Glass polish

### Source and implementation

- supplied logo: `C:\Users\MyPc\AppData\Local\Temp\codex-clipboard-4e6cec1e-58b4-4cce-8da4-0c16c4fcb81c.png`
- switch reference: `C:\Users\MyPc\Pictures\Screenshots\Screenshot 2026-07-29 124000.png`
- profile-actions reference: `C:\Users\MyPc\Pictures\Screenshots\Screenshot 2026-07-29 124042.png`
- savings-bank-selector reference: `C:\Users\MyPc\Pictures\Screenshots\Screenshot 2026-07-29 123934.png`
- implementation route: `http://127.0.0.1:8081/`
- browser: Chrome
- viewport: 390 × 844 CSS pixels
- implementation captures:
  - `design-qa/logo-mobile-390x844.png`
  - `design-qa/settings-mobile-390x844.png`
  - `design-qa/profile-mobile-390x844.png`
- direct comparison inputs:
  - `design-qa/comparison-logo.png`
  - `design-qa/comparison-switch.png`
  - `design-qa/comparison-profile.png`
  - `design-qa/comparison-bank-removal.png`

### Pass 1

- P1: the interface and app/PWA icons still used the former hand-drawn logo.
- P1: the notification control was a flat platform switch rather than Liquid Glass.
- P1: the glass rim used a fixed 32 px radius, causing mismatched corners on pills, cards, and asymmetric surfaces.
- P1: the profile invitation and settings actions visually touched.
- P1: the savings-bank selector remained visible in settings.

### Pass 2

- Replaced the drawn logo with a transparent crop of the supplied artwork and generated safe Expo, adaptive Android, favicon, splash, Apple, and PWA assets.
- Added an animated 60 × 36 glass switch with a 28 px glass thumb, 4 px inset, spring motion, reduced-motion support, semantic switch state, and a 44 px touch target.
- Resolved one corner map from each `GlassSurface` and reused it on the outer surface, highlight, and rim.
- Changed app buttons to pill geometry and added a separate action group below the invitation card.
- Removed only the savings-bank selector UI while preserving persisted/backend compatibility.

### Final pass

- P2: a home CTA caller still overrode the outer button radius to 24 px; removed the override so all button layers share pill geometry.
- P2: the README still pointed to the retired generated-logo script; replaced it with the supplied-logo asset command and removed the old generator.
- The four source/implementation composites show the supplied logo in use, a visibly glass switch, clean separation of profile actions, and the bank selector removed.
- No cropped content, broken radii, merged surfaces, or unsafe overlaps remain in the tested mobile states.
- TypeScript, ESLint, tests, and the 22-route Expo web export pass.

final result: passed

## 2026-08-09 screenshot-matched game rebuild and coin economy

### Source and implementation

- source folder: `C:\Users\MyPc\Documents\Logic-coin\imgs\games imgs`
- implementation routes: `http://127.0.0.1:8081/games/brain-tricks`, `/games/loops`, `/games/gobble`, `/games/longcat`
- browser: Chrome
- direct comparison viewport: 1246 x 693 CSS pixels, matching the supplied source captures
- primary product viewport: 390 x 844 CSS pixels, DPR 1
- tablet verification viewport: 820 x 1180 CSS pixels
- mobile implementation captures:
  - `design-qa-games/brain-mobile.png`
  - `design-qa-games/loops-mobile.png`
  - `design-qa-games/gobble-mobile.png`
  - `design-qa-games/longcat-mobile.png`
- tablet implementation capture: `design-qa-games/gobble-tablet.png`

### Combined comparison evidence

- Brain Tricks source `Screenshot 2026-08-09 153803.png` and the implementation intro were reviewed in the same comparison input at 1246 x 693. The paper-on-desk scene, compact top controls, centered READY flow, typography scale, and lime action hierarchy match.
- Infinity Loop source `Screenshot 2026-08-09 154127.png` and the implementation were reviewed together at 1246 x 693. The dusty rose field, centered instruction, curved rotatable lines, sparse corner controls, and four-dot menu match.
- Gobble source `Screenshot 2026-08-09 154329.png` and the implementation were reviewed together at 1246 x 693, then normalized against the phone-first 390 x 844 capture. The peach field, voxel objects, cactus cluster, movable dark hole, hard shadows, and compact pause control match the supplied direction.
- Longcat source `Screenshot 2026-08-09 154508.png` and the implementation were reviewed together at 1246 x 693. The peach scene, warm white trench border, dark red route, yellow cat head, and minimal icon controls match.

### Iterations and findings

- P1: the first Brain Tricks paper asset exceeded the mobile viewport because of intrinsic web image width. Fixed by constraining the background and image layer to 100% width and height; the verified frame has no horizontal overflow.
- P1: Gobble objects and the hole were too small relative to the reference focal area. Fixed with an original voxel block asset, responsive object spacing, and a larger visual hole while preserving collision geometry.
- P2: Infinity Loop initially rendered every corner as a square bend. Fixed with curved quarter-turn paths while retaining the deterministic rotation and solver logic.
- P2: a Reanimated layout warning was caused by applying entering/exiting and opacity to the same Gobble node. Fixed by separating layout animation from the falling-state transform.
- P3: the supplied games use proprietary character and object art. The implementation keeps the composition and mechanics but uses original generated artwork and the installed icon library instead of copying those pixels.
- Chrome extension errors and local-only analytics script responses were excluded from app findings; no application error overlay or broken route was visible.
- No remaining actionable P0, P1, or P2 visual issues were found.

### Functional verification

- Every game now has persistent game coins, lifetime/spent/transferred totals, skin selection, skin purchase, and conversion at 10 game coin = 1 LC.
- Level completion grants coins; Tetris, chess, and 2048 also use the shared score/win reward path.
- Guest conversion credits the local Logic Coin balance immediately. Authenticated conversion uses an idempotent backend transaction and wallet ledger entry.
- Brain Tricks completion was played in Chrome: level reward changed the HUD to 26 coin, then 20 coin converted into 2 LC and left 6 coin.
- Phone and tablet layouts were visually checked in Chrome; all game routes remained usable without cropped controls.
- Frontend TypeScript, ESLint, 3 smoke tests, 11 engine tests, and the 34-route Expo web export pass.
- Backend TypeScript and 4 game-route tests pass.

final result: passed

## 2026-08-07 game references and independent visual systems

### Source evidence

- Longcat: `https://poki.com/en/g/longcat`
- Gobble: `https://poki.com/en/g/gobble`
- Infinity Loop: `https://poki.com/en/g/infinity-loop`
- Brain Test: `https://poki.com/en/g/brain-test-tricky-puzzles`
- saved source captures: `frontend/artifacts/original-game-audit/`

### Design decisions

- The game catalog is restored to the application's Liquid Glass design and no longer uses the previous shared warm arcade frame.
- Longcat uses its own peach diorama, raised coral playfield, rounded cat trail, and soft compact controls.
- Gobble uses its own peach isometric scene, dimensional voxel-like objects, expressive hole styling, and unobtrusive controls.
- Living Lines uses a minimal dusty-paper palette, thin geometric connectors, almost no decoration, and theme-specific path rendering.
- Brain Tricks uses a notebook scene, bold question hierarchy, playful object art, mascot reactions, and minimal contextual controls.
- The implementations use original names, level definitions, artwork, cosmetics, and text. Source games are references for interaction philosophy and visual language only.

### Functional QA

- Living Lines includes 30 deterministic generated levels, reciprocal-connector validation, a constraint solver, solver-backed hints, undo, reset, best rotations/time, 4 themes, and milestone unlocks.
- Brain Tricks includes 40 declarative original puzzles across 4 stages, tap/drag/drop and multi-step rules, hints, immutable reset, 5 mascots, milestone unlocks, normalized coordinates, validator, and the development-only editor route.
- Existing Longcat and Gobble progress is preserved. New progress fields are added through the version-2 local migration and optional backend fields.
- Browser interaction verified the first Brain Tricks solution from shutter tap through the completion state.
- Static routes render meaningful content for catalog, Longcat, Gobble, Living Lines, Brain Tricks, and the development editor.

### Verification

- frontend TypeScript: passed
- backend TypeScript: passed
- frontend ESLint / React Compiler checks: passed
- frontend tests: 11 passed
- backend tests: 18 passed
- Expo static web export: 34 routes passed

final result: passed

## 2026-08-07 unified warm arcade game style

### Source visual truth and implementation

- source visual truth:
  - `C:\Users\MyPc\.codex\attachments\cd49d883-56eb-4018-91e2-68b45f33be57\image-1.png`
  - `C:\Users\MyPc\.codex\attachments\cd49d883-56eb-4018-91e2-68b45f33be57\image-2.png`
- source pixels: 1242 x 699, 1x raster, landscape 16:9
- implementation route family: `http://127.0.0.1:8081/games/*`
- browser: Codex in-app browser
- implementation viewport: 1280 x 720 CSS pixels, DPR 1
- density normalization: both source and implementation were reviewed at native 1x density; the 3.1% pixel-size difference was normalized by proportional full-frame comparison because both share the same 16:9 aspect ratio.
- state: Russian, light arcade palette, initial game state, level 1 where applicable.
- implementation captures:
  - `frontend/artifacts/game-design-qa/longcat-final-1280x720.jpg`
  - `frontend/artifacts/game-design-qa/gobble-final-1280x720.jpg`
  - `frontend/artifacts/game-design-qa/tetris-final-1280x720.jpg`
  - `frontend/artifacts/game-design-qa/2048-final-1280x720.jpg`
  - `frontend/artifacts/game-design-qa/chess-final-1280x720.jpg`
  - `frontend/artifacts/game-design-qa/games-hub-final-1280x720.jpg`

### Full-view comparison evidence

- Both reference images and the final Trail Cat capture were opened together in one comparison input.
- The implementation matches the reference art direction: solid peach scene, coral playfield, warm white double frame, dark red inner rim, hard offset shadows, yellow active state, dark compact icon controls, and minimal decorative treatment.
- Tetris, 2048, chess, Trail Cat, Pocket Vortex, and the game catalog use the same shared palette, frame construction, shadow geometry, stat cards, button language, and typography hierarchy.
- The reference's notched arena silhouette is intentionally translated into a reusable rectangular frame so it can contain square, tall, free-movement, and irregular game boards without changing game mechanics.
- Record, previous-score, level, attempts, and progress information is intentionally retained from the product requirements; it adds density compared with the reference but uses the same visual language.

### Focused-region comparison evidence

- A separate crop was not required: at 1280 x 720 the 48-58 px controls, 3-4 px frame strokes, hard shadows, labels, and board cells remain clearly readable in the full-view captures.
- Control geometry was additionally verified from browser DOM rectangles; Tetris side controls were fully inside the viewport after the responsive fix.

### Required fidelity surfaces

- fonts and typography: heavy compact display titles, uppercase micro-labels, high-weight numeric stats, and short Russian labels preserve the chunky arcade hierarchy without wrapping or truncation.
- spacing and layout rhythm: centered board composition, compact top status row, consistent 7-14 px gaps, square 4-10 px radii, and hard 4-9 px shadows match the reference rhythm.
- colors and tokens: shared tokens use peach `#FFB38B`, coral `#E87559`, dark red `#B73328`, warm white `#FFF9F1`, yellow `#FFE500`, and ink `#38394A`; no glass gradients remain inside the games.
- image quality and asset fidelity: game UI uses the supplied visual direction and vector icons from `@expo/vector-icons`; no emoji, text-glyph icons, placeholder art, inline SVG, or low-resolution decorative raster is used in the game screens.
- copy and content: only functional game labels, records, level progress, attempts, actions, and collection state remain.

### Comparison history

#### Pass 1

- P1: Trail Cat level 1 rendered at its minimum 22 px cell size on the wide static viewport, making the board much smaller than the reference focal area.
- P1: Tetris kept mobile controls below a 938 px scroll height; control rectangles started at y=776 in a 720 px viewport.
- Fixes: added stable viewport fallbacks and board scaling for Trail Cat; added hydration-safe wide-mode detection and a vertical Tetris control rail next to the board.
- Post-fix evidence: Trail Cat now owns the central focal region; all six Tetris controls are visible beside the board with no horizontal overflow.

#### Pass 2

- P2: quick navigation from 2048 to chess could preserve the previous internal ScrollView position and crop the chess header.
- Fix: reset the game ScrollView immediately and again after focus restoration with `useFocusEffect`.
- Post-fix evidence: the verified 2048 -> chess transition reports `scrollTop: 0`, back-button bounds y=19-67, no overlay, and no horizontal overflow; the final chess capture contains the full header.

### Browser and interaction verification

- all five routes rendered meaningful content at 1280 x 720 with no horizontal overflow and no framework error overlay.
- the page-level console-error buffer reported zero errors on every game route, and no route displayed an error overlay.
- the final accumulated in-app-browser session log contained three warning/error entries from the multi-route static-rendering session; they produced no visible failure, blank state, broken interaction, or route overlay and are recorded as non-blocking runtime noise rather than a visual QA defect.
- tested interactions: Tetris movement, 2048 movement, one legal chess pawn move, Trail Cat movement, and Pocket Vortex movement.
- responsive behavior: wide Tetris controls remain above the fold; mobile/tablet rules retain wrapped bottom controls and width-bounded boards through the shared responsive hooks.

### Findings

- No actionable P0, P1, or P2 mismatch remains.
- P3: the references include sparse decorative pixel squares outside the arena. They were omitted to keep all five game types visually quiet and avoid decorative raster repetition.

### Implementation checklist

- [x] shared warm arcade tokens and reusable UI components
- [x] five game screens restyled
- [x] game catalog restyled
- [x] route transitions reset scroll position
- [x] primary interactions and overflow checked
- [x] TypeScript, ESLint, tests, and production web export passed

final result: passed

## 2026-08-05 unified authentication and games

### Source and implementation

- source route: `https://logic-coin.vercel.app/login`
- implementation route: `http://127.0.0.1:8081/login`
- browser: in-app browser selected by the user
- direct comparison viewport: 573 x 834 CSS pixels
- source capture: `design-qa-spotify/source-login-production.png`
- implementation capture: `design-qa-spotify/login-mobile-390x844-final.png`
- combined comparison: `design-qa-spotify/comparison-login-final.png`

### Comparison history

#### Pass 1

- P1: the old screen mixed password login, registration, guest access, headings, subtitles, and duplicate calls to action.
- P1: Google used the browser locale and the native Google path had no visible error handling.
- P1: chess move indicators intercepted test clicks, and static hydration could leave game boards with zero-sized cells.

#### Final pass

- The authentication screen now has one email field and exactly four actions: email, Google, Yandex, and Telegram.
- Existing emails sign in and new emails register through the same one-time-code flow.
- Google localization is passed both to the script and rendered button; native errors are surfaced to the user.
- Telegram supports bot confirmation, return links, polling, and Telegram Mini App automatic authentication.
- The savings-bank selector and its persisted/backend fields are removed.
- Tetris, local two-player chess, and 2048 are included as local routes with phone-sized controls.
- Email enablement, a complete chess move, Tetris pause/resume, and 2048 controls were verified interactively.
- Responsive checks passed without horizontal overflow at 390 x 844, 820 x 1180, and 1280 x 800.
- TypeScript, ESLint, 18 automated tests, backend build, and the 27-route Expo web export pass.
- No remaining P0, P1, or P2 visual issues were found.

final result: passed
