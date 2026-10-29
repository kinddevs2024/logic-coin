# Translation fix verification — 2026-10-29

Release: `20261029-i18n`.

- Added a shared offline catalog of 1,534 built-in strings with Russian, English and Uzbek values. Placeholder integrity and catalog parity are tested.
- Bound render-time translation to the active language, including React Compiler memoization. Switching language updates the existing screen immediately.
- Covered game copy, dialogs, inputs, administration, challenge catalog titles, errors, system notifications, email verification and static social sharing copy. User names, typed input, URLs, verification codes and custom administrator broadcasts remain data.
- Find Letter uses the selected alphabet; geography preserves answer indices. Existing Hangman visibility and reward rules are unchanged.
- Before backend deployment, compared with a fresh production source snapshot. Preserved already deployed performance, reward and avatar changes. Only 17 backend source files differed from that snapshot and were deployed.

## Validation

- Frontend TypeScript check passed; lint: 0 errors, 17 warnings.
- Frontend: 129 Vitest tests and 16 Node smoke/link tests passed. After the final Uzbek glossary adjustment, the 10 localization-specific tests passed again.
- Backend: 170 tests passed, 17 database integration tests skipped because an isolated test database was not configured. TypeScript build passed.
- Isolated Chrome: guest pages, game intros and administration in all three languages; an additional 21-case pass covered same-page RU → EN → UZ → RU switching, started Geography/Find Letter, and notifications/games/challenges/withdrawals administration. No JavaScript exceptions or unexpected Cyrillic in English/Uzbek screens. API calls were mocked; no notifications or financial transactions were sent.
- Website release marker and script assets verified on logic-coin.online, www.logic-coin.online and the server SSLIP origin. Live API error language and the three localized share images verified.
- Published signed OTA updates to the 11 previously registered Android channel/runtime pairs; verified all signatures, 172 unique resource hashes and HTTP 204 for unknown runtimes. This does not prove installation on a physical phone or compatibility with an unregistered runtime.

## Recovery

Server backup: `/srv/apps/logic-coin/backups/i18n-fix-20261029`.
Release evidence: `/srv/apps/logic-coin/diagnostics/i18n-fix-20261029`.
Website and backend source snapshots, old OTA pointers and immutable releases are retained. Device installation and native platform permission dialogs have not been manually tested on a phone.
