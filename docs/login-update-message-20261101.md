# Login logo and downloaded-update message

Source: b207f6e0a19f935210da88779039b70f280f676c.

Published Android production OTA 1b2c15fa-136e-46ed-9569-896e1ce81d19 for runtime eb44e4d519301c4df181cd2080436edbe6515d96 only. Verified signature and 87 assets; 13 older targets unchanged. No APK rebuild or store publication.

Logo increased to 120 dp. Download completion produces a localized local notification, independent of the Daily reminders toggle, respecting Android notification permission. Deduplicated across downloaded/applied states.

Verification: 27 targeted tests and TypeScript passed. Mi 10 notification service contains the latest update notification and downloaded message. Restarted app to apply the downloaded update; account selector dismissed without choosing an account. Enlarged logo observed on device. Previous keyboard check confirmed email remains above keyboard.
