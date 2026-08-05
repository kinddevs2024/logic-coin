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
