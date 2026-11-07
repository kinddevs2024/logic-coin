# Daily challenge publication incident — 2026-10-30

Production server: 173.212.216.216; Logic Coin backend only.

The daily worker settled expired contests before publishing today's set inside one try block. A historical participant had seven distinct completed game IDs (the daily lineup has six slots); saving DailyContestResult failed its completedGamesCount maximum validation. Every retry stopped before publication. Database inspection confirmed 2026-10-29 was failed and 2026-10-30 was absent.

Recovery: called the existing idempotent ensureDailyChallengeSet for 2026-10-30. It created the ordinary six-game published set with the existing defaults and schedule, leaving existing sets untouched.

Permanent fix:
- Cap the persisted completed-games count at DAILY_CHALLENGE_GAME_COUNT while retaining every earned ledger coin and original finish time.
- Publish before settlement and isolate failures in each operation. Preserve the existing overlap guard and schedule.

Validation: backend TypeScript build passed; 173 tests passed, 17 integration tests skipped without an isolated database. Three regression tests cover repeated settlement failures, independent publication failure, and seven distinct game IDs without losing coins. Tests ran with two workers to limit local resource use.

After deployment, the production user-facing overview returned dayKey 2026-10-30, available=true, published, totalCount=6. The 2026-10-29 settlement and set both became settled. API health passed. No client release or APK rebuild was required.

Rollback backup: /srv/apps/logic-coin/backups/daily-cycle-20261030. Source drift was checked before replacing only server.ts, contest.service.ts, the new daily-cycle helper and their compiled artifacts.
