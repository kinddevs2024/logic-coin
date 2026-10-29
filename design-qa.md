# Hangman design QA

final result: passed

## Visual truth and evidence

Source: C:/Users/MyPc/Pictures/Screenshots/Screenshot 2026-10-28 204453.png (initial), Screenshot 2026-10-28 204558.png (pause), and the other user-provided tutorial/play/result screenshots.
Implementation: ../hangman-initial-en.png, ../hangman-pause-en.png, ../hangman-initial-ru.png, ../hangman-initial-uz.png, ../hangman-hint-en.png, ../hangman-complete-en.png.
Combined comparisons: ../hangman-compare-initial.png, ../hangman-compare-pause.png. Focused clue/letter comparison: ../hangman-compare-detail.png. These images were opened and inspected together with the source.

Viewport: 565 x 1190 CSS px, density 1. Browser screenshots are 587 x 1288; crop top-left 565 x 1190 as confirmed by the iframe viewport measurement. Source initial 568 x 1194 is normalized to 565 x 1190. Pause source is normalized to the same viewport. The initial board has the same BOOK clue and empty letter state. The pause source is at level 2 with partial letters while the implementation is paused at word 1; compare panel geometry and controls, not the intentionally different obscured game state.

## Comparison history

1. P1: paper only filled the upper-left region. Replaced repeat-mode background with explicit tiling of the real raster texture. Final comparison shows the full notebook grid.
2. P2: generated gallows geometry did not align with the source; obtained a closer reference-based raster and placed it at the measured post/baseline coordinates. Final baseline is near y560 and post near x110.
3. P2: underlines sat below the source and font metrics shifted keyboard rows. Set the word strip to 57px and keyboard keys to a fixed 67px row height. Final underlines align near y774; keys stay inside the page.
4. P2: initial typeface lacked the narrow handwritten Latin shapes. Loaded Shadows Into Light Two for English/Uzbek and retained Cyrillic-capable Neucha for Russian. Re-captured and compared the clue and keyboard.
5. P1: the tutorial dimmed its highlighted content. Replaced the solid cover with four masks around the active region.
6. P2: pause close control could clip at the panel border, and sound control was absent. Moved the control inside the paper and added functional audio volume, home and restart controls. Final pause screenshot has no clipped controls.
7. Delivery: ngrok disconnected. Replaced it with the existing valid HTTPS preview virtual host forwarding only to the isolated Metro server. External manifest/bundle verified over HTTPS.

## Required surfaces

- Typography: handwritten Latin/Cyrillic fonts, legible localized clues and keyboard. Fixed row heights prevent font metrics changing board alignment.
- Layout: matching portrait proportions, full grid, measured post/baseline, clue panel, word slots, three-row keyboard, circular pause/hint controls, no viewport overflow.
- Color: off-white paper, pale blue/lavender grid, blue ink, black drawing/borders, green correct marks, red wrong marks, yellow hints and orange navigation.
- Assets: generated transparent raster illustrations and paper; standard icon-library controls. Font licenses are present.
- Content: intentional requested changes are one coin counter, three words per challenge, 1000 cap, gifted hints and three starter hints. Preview disclaimer is deliberately visible. Language follows the application setting.

## Functional evidence

Browser QA recorded PASS for initial English, Russian and Uzbek; a perfect three-word challenge at 1000/1000; hint use reducing 3 to 2; and pause. No captured runtime error events in those runs. Pre-existing development deprecation/reduced-motion warnings remain. Native audio output and phone interaction are not claimed as tested. Typechecks, scoped ESLint and 28 relevant tests passed.

## Follow-up polish (P3)

The freely available handwritten fonts and standard icons are close recreations, not extracted original game assets. Decorative paper clips, torn-paper edges and the original confetti animation are not reproduced. Fine stroke irregularities and some lettering differ. These cosmetic details do not block the playable Expo preview. No actionable P0/P1/P2 issue remains in the checked initial and pause states.

## Implementation checklist

- [x] Initial/tutor/game/result/pause flows implemented.
- [x] Three-word cap and mistake deductions tested.
- [x] Starter gifts idempotency and gift consumption tested in candidate backend.
- [x] Separate Expo process and stable external HTTPS delivery.
- [ ] User phone interaction and native sound check.
- [ ] Release candidate backend before enabling real account gifts; production was intentionally left unchanged.


## Hangman result and fortune menus — 2026-10-28

Selected reference: Screenshot 2026-10-28 204558.png (pause paper panel). Scope: adapt that existing style to the completed three-word result and fortune, preserving the existing reward actions.

Compared the reference, challenge result and fortune screenshots together in `hangman-end-comparison.png`, at the same mobile viewport. Shared graph-paper raster, black border, blue handwritten type and orange action icons match the pause menu. Result content is intentionally adapted: base reward, separate fortune bonus and total. Panels fit within the viewport; all actions and status text are legible. No P0/P1/P2 findings remain.

Browser fixture runs in ru/en/uz passed: result → fortune → animation → result (1000 base + 200 simulated bonus = 1200 total) → next-game action. Real animation was checked against wall-clock time, not only virtual browser time. Fixture uses simulated rewards and does not grant coins. Separate isolated authenticated HTTP integration verified the real backend base cap, rejected unverified ad claims, one-time verified fortune credit above 1000 and duplicate-claim idempotency.

Production website practice runs in ru/en/uz also completed three words and showed the new notebook result at 1000 without runtime errors. Actual rewarded-video playback on a physical phone remains device/provider dependent.

final result: passed
