# Bottom-aligned login and empty-field icon — 2026-10-31

Source: 5ca5c832cb97f9112365913062db1dcba0a124ac. Verified CI JavaScript-only export: 41229153876.

- Empty email keeps its muted mail icon even while focused; any entered text hides it.
- Compact auth layout places the logo in the upper portion and the login card at the bottom, with responsive top spacing.
- Existing keyboard avoidance, scroll-to-field handling, inline submit validation, localized labels and official Telegram artwork remain.

Validation: clean CI typecheck/native-compatibility checks and export passed; targeted ESLint passed. Signed preview and production manifests and 87 immutable assets verified. All 13 older runtime pointers remain unchanged. No APK rebuild, website or Play rollout.

Target APK: 1.3.8/code 14, runtime eb44e4d519301c4df181cd2080436edbe6515d96. Production update 1b92892a-f578-48ba-9fde-04be80ec98f6. Previous production content 62ce3f57-c2fd-48d8-b95d-7892accc9121 is retained for fresh-timestamp rollback.

Server: /srv/apps/logic-coin/diagnostics/login-copy-20261031; published-bottom.json and production-before-bottom.json. Actual source copied to source/frontend/src.

Physical UI/focus/keyboard verification remains blocked by a locked/asleep phone. App was started to fetch the update; no credentials, user-entered text, account, game or reward were changed. An additional isolated browser check did not finish loading its loopback preview and is not counted as passed; its test process and preview server were stopped.
