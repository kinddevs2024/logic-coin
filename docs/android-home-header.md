# Android home controls and top edge — 2026-11-11

Released signed OTA `android-home-header-20261111` from the latest active `chat-profile-back-20261111` artifact. Its home already includes the floating profile/ranking/bell implementation; the new bundle explicitly verifies those markers and carries the feature to all 20 supported channel/runtime targets.

- Home controls remain outside the scroll view, inside the safe area. Their empty gaps pass gestures through.
- The existing Expo StatusBar component now requests `hidden` on Android only. The system clock/icons disappear while the app is active; a physical camera cutout remains a hardware feature and safe-area insets are preserved.
- The Android home scroll edge receives a 12 dp gradient from the theme's top background color to transparent. It is below the controls, ignores touches and does not create an opaque header strip. Web and iOS do not render it.

No native dependencies, runtime selectors, update signing trust, APK version or native assets changed. Latest chat/profile changes, embedded official logo, incremental cache and withdrawal behavior were preserved. Website build was not republished.

Validation: staged TypeScript check and Android/Hermes export; unchanged asset hashes; native header/cache/logo markers in the final bundle; source-level native branch harness at top insets 0, 32 and 40 with fixed positions, working buttons, scroll-through gaps and 12 dp fade. This harness uses browser rendering adapters, not an Android emulator or physical device.

Publication verified signed manifests for all 20 targets and SHA-256 hashes for all 666 public assets; unknown runtimes still receive 204. Physical-device appearance is not yet verified. The existing updater checks on foreground and periodically outside games, downloads the OTA, and applies it on a subsequent full app launch.

Server artifact and rollback metadata: `/srv/apps/logic-coin/staging/android-home-header-20261111/` (`ota-before.json`, `published-all.json`, `bundle-check.json`, `native-harness-check.json`, `previous-source/`, `source-synced.json`). Marker: `/srv/apps/logic-coin/current/android-home-header-ota.json`.
