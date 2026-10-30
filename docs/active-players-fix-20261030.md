# Admin daily active players fix (2026-10-30)

The overview and seven-day graph counted only ActivityDay, a legacy LC-reward journal. Modern coin-game activity and account opens can leave that journal empty. Production showed zero despite existing login and gameplay records.

The read-only count now unions unique user IDs from legacy activity days, coin-reward login timestamps, game start/completion timestamps (both practice and challenge), and last login timestamps. BSON IDs are normalized before deduplication. Calendar boundaries follow the timezone displayed by admin (production UTC). This is daily activity, not concurrent online presence. Budget period activity uses the same definition. No attendance journal or reward balance is written by this change.

Validation: backend TypeScript build passed; 183 tests passed, 17 integration tests skipped. New cases cover modern-only users, cross-source deduplication, legacy-only and empty days, timezone boundaries and resumed game completions. After deployment the actual admin page showed 697 active players for 2026-10-30; the seven-day graph also rendered values. API health returned 200 with database connected. The browser admin tab remains open for review.

Deployment: only admin.service and the new admin-activity.service, with source and compiled artifacts. Backups and file manifest: /srv/apps/logic-coin/backups/active-players-20261030. Previous production source matched the repository baseline before replacement. Website bundles and APK releases did not need rebuilding.
