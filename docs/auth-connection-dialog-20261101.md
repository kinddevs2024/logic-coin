# Illustrated sign-in connection errors

Source: 795c6a0e1339b2877ba6845c1a7e8585ab332a09.

Custom dismissible modal with generated transparent mascot, localized Russian, Uzbek and English connection guidance, and retry action. Google native sign-in checks the public health endpoint before opening the account picker. Manual native SDK failures and Telegram failures no longer show raw system alerts. Email/password connection failures use the same modal, while validation errors retain their inline explanation. Automatic Google prompt connection failures remain quiet until a manual attempt. No native dependencies added.

Verification: TypeScript passed; 9 targeted tests passed, including native/API network codes, server failure distinction, timeout and account selection behavior. ESLint: zero errors, existing guarded native require warning. Isolated browser checks passed for all three languages at 390x844: blocked request opens modal, retry after mocked recovery continues to password step, no duplicate requests or page errors. Preview screenshots captured after fade animation settled. No real accounts or email submissions used. Actual offline Google native picker behavior has not been manually tested on device.

Published signed Android OTA 2926f8c2-f0b8-484b-89f6-4ac65bee908f for runtime eb44e4d519301c4df181cd2080436edbe6515d96. Verified 88 assets and 13 older targets unchanged. No APK rebuild, website deployment or store publication.
