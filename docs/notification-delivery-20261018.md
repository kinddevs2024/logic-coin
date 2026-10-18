# Notification and referral QR update — 18 October 2026

## Published changes

- The native app requests notification permission on entry once while the OS status is undetermined. Dismissing the first dialog does not create a prompt on every later launch. An explicit Enable action can retry.
- After denial, Enable opens the app's Android notification settings directly, with a general app-settings fallback on older Android versions.
- Permission and registration are refreshed when the app resumes. An enabled app preference with granted OS permission hides the inbox permission prompt, including when remote registration temporarily fails. Disabling the app preference still exposes Enable.
- In-app Read all covers the complete inbox, including unloaded pages, gifts and contest results. Its server timestamp cutoff preserves later arrivals and isolates accounts.
- Notification taps mark the matching inbox identity read and dismiss that OS notification. Read all also cancels matching queued local notifications and cannot resurrect them during an ongoing catch-up.
- The dispatch worker excludes individually read notices and notices covered by the account's read-all watermark before remote delivery.
- Browser push retains the matching inbox identity through the service worker and notification click.
- The referral QR uses the existing logo with less internal transparent padding; the reserved QR logo area was not enlarged.

## Native remote-push limitation

**True background delivery to the APK is not configured yet.** The project has no owned Firebase configuration file, Expo project ID or Expo push configuration available in its checked local copies, CI configuration or live server configuration. Local Expo authentication and the checked Firebase/gcloud credential locations are also absent. No borrowed credentials or fabricated push tokens were used.

The app now provides an explicitly local fallback while it is **active in the foreground**: it reconciles unread inbox entries with OS notifications, remembers delivered identities per account, presents the initial backlog silently, and polls every 20 seconds. It does **not** provide server delivery while the app is backgrounded, killed or the phone is locked. It does not claim that system permission alone enables remote delivery.

Existing browser Web Push public/private keys are configured on the server. Browser notification permission is requested from an explicit user gesture, rather than automatically on page load.

Owned Firebase/Expo setup remains necessary for the chosen native remote-push transport. See [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## Verification

- Backend: **200 tests in 47 files passed**, including the four isolated MongoDB read-all tests for 43 entries/unloaded pages, gifts/results, account isolation and concurrent arrivals. Backend TypeScript build passed.
- Frontend: type checking, **102 Vitest tests** and **16 smoke/router checks** passed. Lint reported zero errors and 28 existing warnings before the final permission-network guard.
- Native tests cover permission without an EAS project, denial/settings navigation, a disabled message channel, a dismissed first dialog, registration failure, actual-token registration, silent catch-up of 43 entries, timestamp-safe dismissal and tap identity.
- The daily reminder now replaces only its own scheduled notification; it no longer cancels queued inbox notifications.
- Signed production OTA verification checked the RSA signature and **76 assets** by hash. Unknown runtimes return HTTP 204. APK runtime/certificate compatibility was independently checked against the actual APK and pinned registry Gradle-plugin sources.
- Public homepage, backend health, service-worker file hash and APK download were verified. The new read-all route rejects unauthenticated requests with HTTP 401.
- Physical Mi 10: the combined Read-all/QR/permission build installed over the existing app successfully and launched without Android/React Native runtime errors. Final visual interaction remains pending because the phone was locked or the user was in another application. No unrelated application screenshots or lock bypasses were used.
- The enlarged QR has **not** yet received a successful physical scanner/decoder check; builds are not presented as decoder proof.

## Current release

- App: **1.3.5, version code 9**, `com.kinddevs.logiccoin`.
- APK: https://logic-coin.online/downloads/logic-coin-1.3.5-9.apk
- APK SHA-256: `f193b49e13352a3459c8f326b269c2a410f80d6413e2afd035ebde3c6b7e7e7a`.
- Production runtime: `808cda61091ceb9ef092146bf40cff9341901a68`.
- Source branch: `work/tasks-20261018`, including commits `7a59f5b`, `0d52115`, `2076789` and `4ff5649`, pushed to the existing repository.

The earlier same-day green-release APK hashes in the historical report are superseded by this artifact. Server backups retain the previous backend files, APK and web/OTA pointers under `backups/notifications-20261018` and `backups/notifications-final-20261018`. Temporary APK signing-key copies were removed after signing.
