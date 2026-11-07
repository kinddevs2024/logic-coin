# Inline login email control — 2026-10-31

Source: 00d215f1fe7ad48128e73ae56771e169e05ff5d5. Successful JavaScript-only export: GitHub Actions 41227168312. APK baseline remains signed version 1.3.8/code 14 from run 41201834027.

Changes:
- Removed the initial login heading; password-step context remains.
- Email is a capsule with an embedded round submit arrow. The separate email button is removed. Keyboard Go and arrow share validation and busy-state guards.
- Muted mail icon appears only for an empty, unfocused field. Email input keeps localized accessibility labels and email autofill.
- Replaced the generic paper-plane icon with the original artwork downloaded from https://telegram.org/img/t_logo.svg.
- Auth screens use KeyboardAvoidingView. Compact login scrolls to its field when the keyboard appears; viewport filling uses flexGrow rather than a fixed percentage minimum height.

Validation:
- TypeScript passed locally and in the clean CI export.
- Targeted ESLint passed with no output/errors.
- Native inputs and dependency lockfile match the real installed APK. Export uses the same public client configuration as its build.
- Preview then production manifests signed/verified. All 87 immutable assets verified. All 13 older runtime/channel pointers remain unchanged.

Runtime: eb44e4d519301c4df181cd2080436edbe6515d96. Production update: 62ce3f57-c2fd-48d8-b95d-7892accc9121. Previous compatible production update: f9dcd608-509c-4bf7-97f3-911225350734; rollback script republishes it with a new timestamp if needed.

Server source and delivery records: /srv/apps/logic-coin/diagnostics/login-copy-20261031 (published-inline.json, production-before-inline.json, ci-artifact-inline, source). No APK rebuild, old-runtime rollout, website deployment, account login/logout or real test email registration performed.

Phone was locked/asleep during delivery verification. Started the app to fetch the update, but actual keyboard/input interaction still requires an unlocked phone. Do not report that physical keyboard verification passed until it is observed.
