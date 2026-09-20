# TEST ONLY: Android tab rendering comparison

These APKs are for the disposable Android emulator only. Do not distribute or upload them to a store. They do not measure production authentication, server or advertising performance.

The baseline and candidate use the same x86_64 release runtime, debug signer, local fixture API and ephemeral no-op advertising provider. Existing email/password authentication screens and all four tab layouts remain in use. Source patches happen only inside the QA workflow checkout. Production source and the production APK workflow are unchanged.

Guest mode cannot be used for this comparison: both revisions redirect every unauthenticated/guest user from the tab layout to `/login`, and there is no guest login control in the current UI.

## Build

Run **TEST ONLY Android tabs rendering comparison - DO NOT DISTRIBUTE** on the candidate branch. Its optional `baseline_ref` defaults to `7a50db020a2abf19d56e092223aaacf4ce7a056f`. The workflow is manually dispatched; it has no automatic push trigger.

Each matrix artifact contains a clearly named test APK, SHA-256, signer details, Android package/ABI data and metadata with the actual source SHA. No production API variable, OAuth credential, Appodeal key or signing secret is used. The generated network-security config permits cleartext only to `127.0.0.1`; the main application package stays `com.kinddevs.logiccoin`.

## Local fixture and emulator

Requirements: installed repository dependencies, Node 22, `adb`, and the already prepared disposable `emulator-5562`. Do not use these commands against a physical phone or a personal emulator containing a real account.

From the repository root, validate and then start the server:

```powershell
node scripts/android-tabs-fixture.mjs --self-test
node scripts/android-tabs-fixture.mjs
```

The server binds to host loopback port 8184. It has no upstream forwarding or database integration. Supported mutations affect only in-memory synthetic fixtures; unknown operations return `qa_unsupported`. Logs contain method/path/status and scenario labels, never passwords, tokens, request bodies or headers. Logs are written to `.qa/android-tabs-native/requests.jsonl`.

In another terminal:

```powershell
adb -s emulator-5562 reverse tcp:8184 tcp:8184
adb -s emulator-5562 install -r PATH_TO_TEST_ONLY_APK
adb -s emulator-5562 shell am start -W -a android.intent.action.VIEW -d logiccoin://login com.kinddevs.logiccoin
```

Use the existing login UI with the deliberately fake fixture values:

- Email: `qa@example.invalid`
- Password: `qa-local-only-123`

`/auth/email/start` returns the password step; `/auth/login` returns a synthetic user and local-only opaque tokens; `/bootstrap` supplies the wallet, language, theme and challenge data. The fake session has no meaning on any real service. The PNG avatar is generated locally and loaded from the fixture server.

If replacing an APK fails due to signer/version mismatch, uninstall **only `com.kinddevs.logiccoin` from `emulator-5562`**, then install and perform the same synthetic login. This deletes only that disposable emulator's app data. Do not change production signing or application code to work around the mismatch.

## Reproducible scenarios

Set the same server scenario before each baseline/candidate pass, then cold-launch or refresh the app to obtain a new bootstrap:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8184/_qa/reset
$scenario = @{ label = 'baseline-light'; theme = 'light'; balance = 640; completed = 1 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8184/_qa/scenario -ContentType application/json -Body $scenario
```

`theme` accepts `light`/`dark`; `balance` accepts 0–1000 for jar states; `completed` accepts 0–6. Change only `label` between otherwise identical baseline/candidate runs. Use `/_qa/health` and `/_qa/requests` for fixture-only diagnostics. Leave challenge gameplay, rewards, withdrawals, referral links and external sign-in outside this rendering check.

Check home → challenges → catalog → profile, repeated tab swipes, rapid catalog flings, skins open/close, avatar/jar loading and returning to the prior scroll position. Compare screenshots at mobile/tablet effective widths and collect Android frame timing/memory on the same emulator configuration. A browser pass does not establish Android rendering performance, and emulator results do not replace a physical-device check.

After testing, stop the fixture server and remove its reverse mapping:

```powershell
adb -s emulator-5562 reverse --remove tcp:8184
```
