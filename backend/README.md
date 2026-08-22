# Logic Coin API

TypeScript, Express 5 and MongoDB backend for the Logic Coin MVP. It is stateless,
uses lazy database connections, and can run as a local Node process or a Vercel
serverless function.

## Local setup

1. Copy `.env.example` to `.env` and replace placeholders.
2. Install dependencies with `npm install`.
3. Run `npm run dev`.
4. Open `GET http://localhost:4000/api/v1/health`.

Never commit `.env`. Production requires independent `JWT_SECRET` and
`OTP_PEPPER` values of at least 32 characters. The admin console is disabled
until `ADMIN_PASSWORD_HASH` (bcrypt) is configured; production also requires a
separate `ADMIN_JWT_SECRET`.

## Commands

- `npm run dev` — local watch server
- `npm run typecheck` — strict TypeScript check
- `npm run test` — Vitest suite
- `npm run build` — compile into `dist`
- `npm start` — start the compiled server

## API

All responses use `{ "data": ... }`. Errors use
`{ "error": { "code", "message", "details?", "requestId" } }`.
Protected routes require `Authorization: Bearer <accessToken>`.

### Public

- `GET /api/v1/health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/email/verify`
- `POST /api/v1/auth/email/resend`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/google`
- `GET /api/v1/auth/yandex/start`
- `GET /api/v1/auth/yandex/callback`
- `POST /api/v1/auth/yandex/exchange`
- `POST /api/v1/admin/auth` — password exchange for a short-lived admin JWT

### Authenticated

- `POST /api/v1/auth/logout`
- `GET /api/v1/bootstrap`
- `GET|PATCH /api/v1/me`
- `GET|PATCH /api/v1/me/preferences`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks/:taskIdentifier/claim`
- `GET /api/v1/wallet`
- `GET /api/v1/wallet/ledger`
- `GET /api/v1/activity`
- `POST /api/v1/activity/check-in`
- `GET /api/v1/bonuses`
- `POST /api/v1/bonuses/:kind/claim`
- `GET /api/v1/referrals`
- `POST /api/v1/referrals/apply`
- `GET|POST /api/v1/withdrawals`
- `GET /api/v1/devices`
- `PUT /api/v1/devices/:deviceId/preferences`
- `DELETE /api/v1/devices/:deviceId`

`PATCH /api/v1/me/profile` accepts `avatarDataUrl` only (JPEG, PNG, or WebP,
maximum 1.5 MiB); arbitrary URLs and other data payloads are rejected.

### Administrator

Every route below requires `Authorization: Bearer <adminToken>` from
`POST /api/v1/admin/auth`:

- `GET /api/v1/admin/overview?dayKey=YYYY-MM-DD`
- `GET /api/v1/admin/games`
- `POST /api/v1/admin/games`
- `PATCH /api/v1/admin/games/:gameKey`
- `GET /api/v1/admin/daily-challenges?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/admin/daily-challenges/:dayKey`
- `PUT /api/v1/admin/daily-challenges/:dayKey` — save draft or publish six manual/random games
- `POST /api/v1/admin/daily-challenges/:dayKey/settle`
- `GET /api/v1/admin/budget?days=30`
- `POST /api/v1/admin/budget/entries` — idempotent revenue/expense ingestion

Publishing creates one durable `NotificationEvent` outbox record. Public
`GET /api/v1/challenges/today` never auto-creates a challenge: until an admin
publishes it, the endpoint returns `status: "no_challenge"` and
`nextChallengeAt`.

Task claims and withdrawals require an `Idempotency-Key` header or an
`idempotencyKey` body field. The server chooses every reward, enforces cooldowns
and daily limits, and commits claims, ledger entries, activity, and wallet
changes together in MongoDB transactions.

## MVP safeguards and boundaries

- Money and reward values are stored only as integer cents or integer units.
- One unit is `UNIT_VALUE_CENTS` cents (default: one cent).
- Minimum withdrawal is `MIN_WITHDRAWAL_CENTS` (default: 1000 cents / USD 10).
- Withdrawals are explicitly sandbox-only and move funds to the locked balance.
- Seeded tasks use the `demo` provider, so a valid claim immediately awards the
  configured reward. A real rewarded-ad verification provider can replace this
  boundary later without trusting a client-supplied amount.
- Refresh tokens are random opaque values and only SHA-256 hashes are stored.
- Access JWTs are accepted only while their backing refresh session is active.
- Rotated refresh-token reuse revokes the entire token family.
- Email verification requires the one-time registration token returned by
  `/auth/register`; the database stores only its SHA-256 hash.
- Yandex OAuth uses a one-time, browser/device-bound state and server-managed
  PKCE S256 challenge.
- Passwords use bcrypt; email codes are six digits and stored as HMAC hashes.
- Email, Google, Yandex, MongoDB, and Telegram credentials come only from runtime
  environment variables.
- The admin password is never stored in plaintext; only a bcrypt hash is read
  from runtime environment variables, and admin JWTs use a separate audience.
- Telegram notifications are attempted only when both the bot token and admin
  chat ID are configured.
