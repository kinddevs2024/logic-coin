# Inbox read receipts and challenge history cash — 2026-10-31

Release: `20261031-inbox-history`.

The Telegram menu points to the current deployment. Verified through getChatMenuButton and the HTML release marker; its existing version query parameter does not select a separate build.

Inbox visibility checks now repeat while the panel is mounted and resume when the document or app returns to the foreground. Visible rows have an 800ms dwell threshold; hidden and offscreen rows remain unread. Timer and listeners are removed on unmount. Existing ownership validation and retry behavior remain unchanged.

History returns cashUnits from the selected day's DailyContestResult for both paginated rows and the user's pinned row. Non-cash and older records show zero. Live estimates use the same configured contestPrizePlan as current rankings. The live-day status is displayed to distinguish unfinished results. Money uses the existing cents-to-dollar formatter.

Validation:
- Frontend typecheck and backend build passed.
- Five targeted backend tests passed, including settled cash, zero-cash legacy records and the live prize plan.
- Isolated Chrome fixtures: ordinary stationary inbox passed; background-to-foreground scenario failed on the previous release and passed on the fix. Unseen tenth item remained unread. Cash appeared in both ranking rows and the pinned self row. No page exceptions.
- React checklist: hooks remain unconditional; interval and listeners clean up; stable callback dependencies; no extra network requests once rows are marked read; no new dependencies.
- Production read-only check for 2026-10-30: all 15 first-page rows include cash; self matches stored cash prize; non-cash self returns zero. No notifications were sent and no real reward or read receipt was changed during verification.
- Published and verified three web origins, ten entry assets, thirteen signed compatible Android OTA targets and 172 unique immutable assets. API health is OK with database connected.
- Backup and rollback material: /srv/apps/logic-coin/backups/inbox-history-20261031. Source and exports: /srv/apps/logic-coin/diagnostics/inbox-history-20261031.

Physical-phone behavior has not been tested. Close and reopen the Telegram Mini App to load the new web entry.
