# Native FCM release verification — 2026-10-18

Final signed GitHub build: https://github.com/kinddevs2024/logic-coin/actions/runs/39124499750

App source: `98cacc5bed6d94e2f06eff6c8041ab0590c0d521`. Package `com.kinddevs.logiccoin`, version `1.3.5`, versionCode `9`, update channel `production`. Actual APK runtime: `55fdd7f5d61bcb5a8586450d54fb36093c03626e`.

Local artifacts: `C:/Users/MyPc/Documents/Global-olimpiad/logic-android-artifacts/newfcm/logic-coin.apk` and `logic-coin.aab`, with SHA256 manifests and source/runtime provenance.

Public APK: https://logic-coin.online/downloads/logic-coin-1.3.5-9-fcm.apk

- APK SHA256: `e042cb08c85eb031eee4c7e1c86e7fa5ffad466a8451a513cfc16b6a4776141c`
- AAB SHA256: `5c21f933d022881e7da53331564d0af5f812dd9a1549ce18cea10adcbfca9417`
- Signing certificate SHA256: `85da6343aa98cddb89a8090dadfff7525441ba5cd97503e429f5074fd16e3822`, matching the existing APK.

Verified downloaded artifact hashes against CI manifests and public APK against local hash. APK v2/v3 signature and 16KB zip alignment passed. AAB JAR signature and bundletool validation passed. Firebase Android resource values match the official configuration's project, sender number and Android application. AAB is retained locally and in GitHub; nothing uploaded to Play Console. The previous public APK remains intact.

Backend direct FCM deployed with protected sender credentials outside repository, authenticated privately, public health 200 and native-provider enabled. Scoped sender credentials were never placed in GitHub or application artifacts. Rollback: `/srv/apps/logic-coin/backups/fcm-20261018T114534Z/rollback.sh`; pre-FCM rollback: `/srv/apps/logic-coin/backups/fcm-20261018T114220Z/rollback.sh`.

Source verification: both typechecks passed. Before the final tray follow-up, full backend 204 tests and frontend 104 Vitest plus 16 smoke tests passed. Final follow-up typechecks and 22 focused tests passed; final CI also ran frontend lint/typecheck/tests. Tray checks cover foreign FCM identifiers, preserved creation timestamps at read-all cutoff, delayed delivery and malformed/unrelated identifiers.

## Remaining device verification

At verification time ADB and mDNS showed no connected phone, and the server had zero enabled native FCM registrations. The new APK must be installed over the existing app and opened once to register its native token, followed by a real notification sent while backgrounded/closed and tap/read-all checks. OAuth success and a validate-only request with a deliberately invalid placeholder token are not proof of delivery. No actual device delivery has been claimed.

Older installed APK runtime `808cda61091ceb9ef092146bf40cff9341901a68` lacks Firebase native resources. A JavaScript OTA cannot add them; the new signed native APK is required. No incompatible OTA was published.
