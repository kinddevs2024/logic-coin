# Signed game updates

Status: delivery service configured; physical-device end-to-end verification pending.

The next Android binary embeds the public certificate and expo-updates. Existing binaries cannot gain this native capability through a JavaScript update. Expo Go is not an OTA acceptance-test target.

## Release boundaries

- The catalog is controlled by the authenticated admin API. Disabling a game preserves player history.
- New mechanics must be registered in the app source and delivered in a signed JavaScript/assets export; a catalog row alone does not implement a game.
- Native dependencies, permissions, certificate rotation, and other native changes require a new store binary.
- Fingerprint runtime versions prevent updates from being loaded by incompatible binaries. Never guess the runtime or disable this check.
- Preview and production are separate request channels. Publish to preview first, then test an installed release build before production.
- Updates download on launch with no blocking cache timeout. No mid-game forced reload is implemented.

## Publisher

Export Android with the same configuration and native dependencies used for the target build. Resolve the fingerprint runtime using Expo's runtime resolver and record it alongside the build artifact. Export public Expo config to JSON; never include private server env values.

On the trusted server only, set `OTA_STORAGE`, `OTA_PRIVATE_KEY`, `OTA_CERTIFICATE`, and `OTA_PUBLIC_URL`. The private signing key is outside the repository and inaccessible to the read-only delivery service.

Run `node publish.mjs EXPORT_DIRECTORY PUBLIC_CONFIG_JSON EXACT_RUNTIME preview android`. Preserve the export, manifest, signature, and immutable assets. After installed-device validation, publish the identical content to production. Do not publish a test fixture to production.

To revert faulty JavaScript content, run `node rollback.mjs ARCHIVED_RELEASE_ID CHANNEL`. This verifies the archived signature and republishes old content under a fresh identifier and timestamp. Merely pointing to an older manifest does not reliably roll clients back. Native incompatibility cannot be fixed by this rollback.

## Verification before calling this complete

1. Public HTTPS health endpoint returns JSON, not the website HTML.
2. Unknown channel/runtime returns no update. Invalid selectors are rejected.
3. Signed manifest and every immutable asset download successfully; tampering fails signature/hash validation.
4. Installed preview APK downloads and runs an identifiable test update after restart.
5. Offline launch works; a failed update leaves the embedded/cached app usable.
6. Re-published rollback content loads on the same installed binary.
7. Admin create/edit/archive is tested without removing results or affecting ordinary-game/common-wallet separation.

References: https://docs.expo.dev/technical-specs/expo-updates-1/ and https://docs.expo.dev/eas-update/code-signing/.
