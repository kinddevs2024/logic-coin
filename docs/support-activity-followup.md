# Channel editor, activity guidance and shared support

The channel field editor reused the same animated ChatSheet as the overview. Closing a field left opacity at zero and the closing guard set, while the overview's controls were still interactive. Field, member and overview sheets now have distinct React keys. Escape is handled by the top sheet during entrance as well as after entrance; the messages screen ignores Escape while a modal is open. X cancels a field back to the overview; Escape dismisses the editor to the conversation, and the next Escape returns to the conversation list.

Member listing uses six records initially and an explicit Load more action. The API returns a stable membership-ID cursor, total count and the next cursor; the frontend appends pages. Read permission is checked for every page. Existing room management permissions remain in force.

Weekly and monthly explanations appear when the respective heading becomes visible, once per account/period/browser, using server-supplied period boundaries. They wait for any existing modal to close. The information button can always reopen them. The homepage introduction explains the six daily games and is acknowledged once per account via `preferences.homeIntroSeen`; browser storage also suppresses repeats if account synchronization is temporarily unavailable. This preference accepts only true through the self-service API. Activity cards have a subtle decorative wave baseline at 30%; the actual progress layer, displayed percentage, accessible value and challenge eligibility retain actual completed-day values.

Support keeps one conversation per customer (`support:<customerId>`). Current Manager, Admin and Owner roles share the conversation, history and incoming updates. New messages notify all unmuted participants through the existing notification pipeline. Staff replies appear as Logic Coin Support; the stored sender ID remains the real author for audit. Personal direct messages remain separate. Personal user-to-user blocks do not disable the platform support service. Existing support IDs/history are reused, including legacy rooms assigned to one administrator.

Support access is checked against the current persisted platform role on every read and write. Ordinary users cannot access another customer's conversation, even with a stale membership. Demoted staff are excluded from listings, new message recipients, conversation reads/writes and signed customer attachment access. New staff see existing requests. Staff chat listings retain the existing 100-conversation limit.

Validation:
- Frontend TypeScript and production web export; backend TypeScript build.
- 34 isolated database/policy tests, including all three staff roles, notification recipients, shared reply history and audit authors, separate customers, demotion/promotion, legacy support, read receipts, member cursors and account introduction persistence.
- Browser tests: 320/470/1440px, RU/UZ/EN, mouse and touch; field cancellation, opacity, unexpected file chooser, member pagination, Escape stack, weekly/monthly renewal and one-time introduction. All API calls in browser tests use fixtures; no messages sent to actual users.

Deployment uses the latest active server release as a baseline, changes only the selected sources/compiled backend files and rebuilt website, retains older hashed web assets for open tabs, and supports rollback. No APK or native OTA release is included.
