# Platform roles

Published 2026-11-12 to the website/API and Android OTA (`platform-roles-20261112`).

| Role | Ordinary account | Direct messaging without friendship | Administration | Owner reports | System notifications |
| --- | --- | --- | --- | --- | --- |
| User | Yes | Friends (may also contact/reply to staff) | No | No | No |
| Manager | Yes | Yes | No | No | No |
| Admin | Yes | Yes | Yes | Yes | Yes |
| Owner | Yes | Yes | No | Read only | No |

Chat-room owner/admin membership is separate from platform roles. Staff messaging never overrides explicit blocks. Room invitation and moderation rules remain separate. Staff can use messages and reports during a live raffle without the viewer lock redirect.

## Entry points

- `/admin/users`: change a role with a reason; a separate operation from editing the profile/balance. Database transaction, audit record, expected previous role, serialized role mutations, actor revalidation. Self-demotion is rejected and at least one administrator must remain. Existing nickname editing is preserved.
- `/owner`: overview, daily activity, contest rewards, budget, revenue/expenses, withdrawals by status, challenge history and up to 500 daily prize recipients. Uses the same analytical functions as Admin with settlement side effects disabled. No financial/profile mutation endpoints or controls. Owner/Admin only, checked against current database role on every request. Responses and report queries are excluded from the native persistent cache.
- `/admin/notifications`: system message composer with title/body, optional recipient name/email, preview showing the audience, then send. Stored as `admin_broadcast` in the System inbox even without push-enabled devices; push is additional. Manager/Owner have no access. No real messages were sent during deployment or tests.
- Shared `Avatar` renders a current platform role tag for non-users via one shared React Query directory (`/profile/roles`, public IDs/roles only). This covers home, rankings, profiles, chat participants, referrals and other avatar-based lists, including historical scores. Chat profiles also expose `platformRole` separately from room member `role`.

The persisted role is authoritative. Admin allowlist fallback was removed from authorization and existing-account login. Existing first-account provisioning configuration is unchanged. Preflight found 2 persisted Admin accounts, zero accounts relying only on the legacy email authorization; no account roles needed migration or reassignment.

## Validation and delivery

- Backend/frontend TypeScript checks; production web export and Android Hermes export.
- 45 passing tests (including 18 isolated MongoDB replica-set integration tests): role assignment/audit, stale updates, concurrent cross-demotion, read-only reports, immediate access revocation, staff messaging and blocked recipients. Ordinary profiles cannot smuggle a role through the profile editor.
- Browser fixtures on draft and public website: Owner at 1440px/390px; Admin role editor and system-message preview/send (intercepted requests); Manager/User denied Owner UI. No horizontal overflow or browser errors. Fixture data only, all API requests intercepted.
- Android: latest active `admin-username-20261112` source preserved; native dependencies/runtime unchanged, embedded official logo, incremental cache, fixed home header and status fade retained. 20 signed preview/production targets; 666 public asset hashes checked; unknown runtime returns 204. No physical Android device available.
- Server stages: `/srv/apps/logic-coin/staging/platform-roles-20261112` and `platform-roles-native-20261112`. Source/compiled-file baseline guards, previous-source/web backups and OTA rollback pointers retained. Current release symlink unchanged; existing hashed web chunks retained.

## Reproduce checks

`npm run typecheck --workspace backend` and `npm run typecheck --workspace frontend`.

`npm run test --workspace backend -- --run tests/admin-middleware.test.ts tests/admin-user-profile.test.ts tests/chat-policy.test.ts`.

Integration tests require `QA_MONGODB_URI` pointing to an isolated replica set at `127.0.0.1:27951`; the suite refuses other addresses and deletes only its uniquely named QA database. Never use production credentials.

`ROLES_URL=http://127.0.0.1:8117 node frontend/tests/platform-roles-browser.cjs` with an exported web preview. Screenshots/report go to `/workspace/shared/roles-*`.
