# Short login copy and applied-update message

Source: a2e3cdc40a6a7e2211373d79e10c7f438bb78088. Verified export: GitHub Actions run 41224890098.

- Login title shortened (RU/UZ/EN), explanatory subtitle removed.
- Email divider shortened; repeated email label/asterisk and helper text removed. Accessible email label retained.
- Android shows a plain native toast after an OTA update is applied, once per update ID, localized to RU/UZ/EN. Fresh embedded APK launches do not trigger it; gameplay defers it until leaving /play/.
- Typecheck and three update-notice tests passed. CI validates unchanged native/dependency inputs against the actual signed APK build, then exports only JS/assets with the original client configuration.

Delivered using the APK's actual embedded fingerprint eb44e4d519301c4df181cd2080436edbe6515d96 (version 1.3.8/code 14). The original APK update certificate matches the server certificate by DER fingerprint. Published and verified preview then production. All 87 unique assets/signatures verified; all 13 older target pointers remained byte-for-byte unchanged.

Production update: f9dcd608-509c-4bf7-97f3-911225350734. Compatible rollback content: 9f3e7bde-52de-4f9c-a9f2-497fe1cb10eb (publish afresh through rollback.mjs to use).
Server stage: /srv/apps/logic-coin/diagnostics/login-copy-20261031. published.json records IDs and verification results. No APK rebuilt, no website or Play release.

Phone was started to fetch OTA and restarted; app process runs without fatal exceptions. Visual confirmation was blocked by the phone's lock screen; user asked to unlock it. Do not claim the updated UI is visible until checked after unlock.
