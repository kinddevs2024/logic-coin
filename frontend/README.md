# Logic Coin frontend

Universal Expo SDK 57 client for Android, iOS and the web. The same Expo Router
codebase covers onboarding, email/social authentication, the animated savings
experience, tasks, streak bonuses, profile activity, settings, referrals and
withdrawal eligibility.

## Setup

```bash
cp .env.example .env
npm install
npm run start
```

Required public environment values:

- `EXPO_PUBLIC_API_URL` — complete API prefix, for example
  `http://localhost:4000/api/v1`.
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` — Google Identity Services web client ID. This
  is a public OAuth identifier, never a client secret.

For Yandex web OAuth, add each deployed callback URL
(`https://your-host/oauth/yandex`) to the backend `YANDEX_REDIRECT_URIS` list.
Native Yandex auth uses the `logiccoin://oauth/yandex` deep link and Expo's
secure auth session.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build:web
```

`npm run check` runs all four in sequence. Vercel builds the static Expo export
from `dist/`. The EAS `preview` profile produces an installable Android APK.

## Reward behavior

Guest mode stores progress locally through AsyncStorage on the web and
SecureStore on native devices. Signed-in task claims call
`POST /tasks/:taskIdentifier/claim` with an idempotency key. Until a rewarded-ad
provider is connected, pressing a demo task immediately grants its configured
reward, exactly as requested for the MVP.

Brand assets are original Logic Coin artwork. Run
`node scripts/generate-brand-assets.mjs` if the PNG exports need to be
regenerated from the source concept.
