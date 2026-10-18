# Native background push preparation — 2026-10-18

The existing foreground inbox mirror does not deliver while Android is closed. This change adds direct Firebase Cloud Messaging HTTP v1, preserving existing Expo and web subscriptions. Android registration uses the native token without an EAS account; a device with an FCM token is not sent a second Expo notification. Logout and token ownership changes revoke native tokens too. Messages include an OS notification and string-only inbox routing data. Provider acceptance is not proof of device delivery.

## Required owned Firebase configuration

Android package: `com.kinddevs.logiccoin`.

1. In the owner's Firebase project, register this exact Android app and download `google-services.json`. Supply it as protected GitHub secret `GOOGLE_SERVICES_JSON_BASE64` (or local `GOOGLE_SERVICES_JSON` path). This is Android client configuration; never put a service-account private key in the app.
2. Enable Firebase Cloud Messaging HTTP v1. Supply a service-account JSON with the scoped Firebase Cloud Messaging API Admin role (`roles/firebasecloudmessaging.admin`, permission `cloudmessaging.messages.create`) for this project. Store it outside the repository on the server with mode 600 and configure `FCM_SERVICE_ACCOUNT_FILE` to its path. Do not grant Owner or commit the file.
3. Dispatch the Android workflow with `require_background_push=true`. Its explicit guard validates the package and required Firebase fields. Keep regular test builds available without this flag. Build and install a new signed native APK: OTA cannot add Firebase resources to an older binary.
4. Verify registration, send an actual administrator notification with the app backgrounded and normally closed, then verify notification tap reads only that inbox item. Force-stopped Android apps are subject to Android delivery restrictions.

No Firebase project, credentials, permissions or cloud account were created by this change. The currently installed APK contains no Firebase resource configuration. Final build/publication is intentionally pending the two owned configuration files and real device verification.

Official references: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk and https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging
