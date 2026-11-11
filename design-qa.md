# Home activity blocks — visual QA

final result: passed

Source: `previews/home-activity/public/`, user-supplied screenshots and `/workspace/shared/home-preview-compact.png` (430 × 362). Implementation: `/workspace/shared/home-blocks-week-470-graphite.png` (430 × 368); comparison: `/workspace/shared/home-blocks-comparison.png` (860 × 368). Both are 1× CSS pixels. The page viewport is 470 × 900, card width 430. Content differs intentionally: the source has demo names and a fixed scenario clock; implementation uses isolated API fixtures for verification of the production data path. Reel positions vary as they scroll.

Full-page evidence: `/workspace/shared/home-blocks-page-1440-dark.png`. Focused daily, weekly and monthly captures: `/workspace/shared/home-blocks-{games,week,month}-{470-graphite,1440-dark,320-light}.png`. The final browser report is `/workspace/shared/home-blocks-check.json`.

## Comparison history

Initial pass: overly saturated green participant badges/border differed from the quiet mint reference; period cards had excess vertical padding. Adjusted muted mint/gold display tokens and period padding. Kept the site's selected theme for background and primary controls. Final combined comparison was opened after the fixes; no actionable P0/P1/P2 differences remain.

## Fidelity surfaces

- Typography: Inter/system sans, 18px mobile section heading, 14px reel names, small tabular clock/balance badges, bold percentage. Long names truncate; narrow screens retain the timer and info control.
- Layout: three independent rounded cards, daily list at 202px collapsed, 220px reel (204px on narrow screens), compact 60px profile. Games fade through a mask rather than an opaque rectangular overlay. Desktop keeps the existing two-column home structure with the new card column aligned at the top.
- Colors: existing application theme is intentionally respected, so graphite/green/light backgrounds differ from the demo's forced blue-grey theme. Mint/gold badges preserve the reference hierarchy. Wave fill uses the current accent with sufficient text contrast.
- Assets: existing game cover assets and real Avatar component reused. No replacement illustrations or placeholder artwork. Existing demo wave paths and masks reused for the requested animated progress effect.
- Content: only three requested blocks transferred. No scenario chooser, preview header, demo navigation or demo check-off actions. Real API values replace sample names, amounts and progress. Current profile remains visible independently of the reel.

## Interaction verification

Exported app tested in Chromium at 470, 1440 and 320px; graphite, dark and light themes. All three cards render; expand/collapse works; hidden game actions cannot be tabbed to; 0% and 33% reflect API progress; rules dialog opens and Escape closes it; no horizontal overflow; reduced-motion disables waves; no page errors. A simulated API failure shows a retry control and recovers successfully. Eligible current users are included in the reel; ineligible ones keep only their separate profile card. Earlier pass also covered 485px. Browser fixtures isolate requests from production accounts; database-backed end-to-end verification has not been performed.

## Release boundary

Draft only. Production website and Android OTA are untouched. New authenticated read endpoint must accompany the website build when this draft is deployed. Prize settlement and live draw behavior are unchanged.
