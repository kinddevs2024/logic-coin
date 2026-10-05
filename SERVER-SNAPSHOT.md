# Logic Coin server source snapshot

This branch preserves source code recovered from the verified full-server backup dated 2026-10-04. It does not restore or deploy the server.

Backup archive SHA-256: `ab3b96e6391b7a42d465fe7eed3240520e0ef65b573995d0014bbcb8a497e04a`.

Only Logic Coin application source, public assets, package metadata, and source tests/configuration are included. Database dumps, user records, environment files, credentials, private keys, dependency folders, built output, and server configuration are excluded.

The original complete confidential backup remains local. Later Expo Go / APK preview edits are held separately in `.codex-apk-update` and are not represented as production server changes here.

Extraction verified the archived `current` link points to `/srv/apps/logic-coin/staging/release-7cc0ccbad61cfa4ee57f055d0903c192e62379a5`. All 556 selected files matched the extracted backup byte-for-byte before Git line-ending normalization. Sensitive-path and common credential-pattern checks passed for the selected publication files.

The repository's existing CI and non-selected documentation are retained; source and test trees are mirrored from the backup. This branch is a preservation snapshot, not a claim that all application tests or physical-device checks pass.
