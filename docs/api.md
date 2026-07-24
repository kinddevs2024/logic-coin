# REST API Logic Coin

Этот документ фиксирует контракт текущего MVP. Все прикладные маршруты находятся под префиксом `/api/v1`.

## Общие правила

- Production base URL единого Vercel deployment:
  `https://<project-domain>/api/v1`.
- Локально: `http://localhost:4000/api/v1`.
- Формат: `application/json; charset=utf-8`.
- Даты и время: ISO 8601 UTC; календарные дни: `YYYY-MM-DD` в timezone пользователя.
- Денежные значения — целые `*Cents`, внутренняя награда — целые `*Units`. `UNIT_VALUE_CENTS` задаёт стоимость одной unit.
- Защищённые маршруты требуют `Authorization: Bearer <accessToken>`.
- Язык задания определяется сохранённым `preferences.language`: `en`, `ru` или `uz`.
- Изменяющие баланс task/withdrawal запросы требуют idempotency key длиной 8–160 символов в заголовке `Idempotency-Key` либо одноимённом camelCase поле body.

Успешный ответ обёрнут в `data`:

```json
{
  "data": {
    "example": true
  }
}
```

Ошибки имеют стабильный lowercase `code`. `x-request-id` также возвращается заголовком:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": {},
    "requestId": "0f53cbe8-b84c-4c8d-99ea-e180ed8bbcc3"
  }
}
```

Типовые статусы: `400` validation, `401` auth, `403` forbidden, `404` not found, `409` business conflict, `429` rate limit, `500` unexpected error. `details` присутствует только там, где сервер сообщает безопасный дополнительный контекст.

## Публичные маршруты

### `GET /health`

Liveness и состояние подключения к базе:

```json
{
  "data": {
    "service": "logic-coin-api",
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-07-24T12:30:00.000Z"
  }
}
```

### `POST /auth/register`

Создаёт неподтверждённый аккаунт или обновляет незавершённую регистрацию и отправляет шестизначный код.

```json
{
  "email": "user@example.com",
  "password": "a-strong-password",
  "name": "Aziza",
  "referralCode": "LC-OPTIONAL"
}
```

Ответ `202`:

```json
{
  "data": {
    "userId": "688...",
    "email": "user@example.com",
    "registrationToken": "<one-time-registration-token>",
    "verification": {
      "delivery": "sent",
      "expiresInSeconds": 600
    }
  }
}
```

Клиент хранит `registrationToken` только до завершения проверки email и не пишет его
в логи. Повторный `/register` для ещё не подтверждённого email заменяет пароль и
registration token; предыдущий token сразу становится недействительным.
Registration token действует не более 24 часов, а срок OTP задаётся
`OTP_TTL_MINUTES` (по умолчанию 10 минут).

В non-production при явно включённом `OTP_EXPOSE_CODE` verification дополнительно содержит `devOtp`. В production код никогда не возвращается.

### `POST /auth/email/verify`

```json
{
  "email": "user@example.com",
  "code": "123456",
  "registrationToken": "<token-from-register>",
  "deviceId": "optional-installation-id"
}
```

Ответ содержит пользователя и token pair:

```json
{
  "data": {
    "user": {
      "id": "688...",
      "email": "user@example.com",
      "emailVerified": true,
      "name": "Aziza",
      "referralCode": "LCABC123",
      "preferences": {},
      "wallet": {}
    },
    "tokens": {
      "accessToken": "<jwt>",
      "refreshToken": "<opaque-token>",
      "refreshTokenExpiresAt": "2026-08-23T12:30:00.000Z",
      "tokenType": "Bearer"
    }
  }
}
```

### `POST /auth/email/resend`

```json
{
  "email": "user@example.com"
}
```

Ответ `202` содержит `email` и `verification`. Endpoint защищён cooldown/rate
limit. Resend создаёт новый OTP, но не возвращает и не меняет
`registrationToken`; клиент продолжает использовать token из последнего
`/auth/register`.

### `POST /auth/login`

```json
{
  "email": "user@example.com",
  "password": "a-strong-password",
  "deviceId": "optional-installation-id"
}
```

Ответ: `{ "data": { "user": {}, "tokens": {} } }`.

### `POST /auth/refresh`

```json
{
  "refreshToken": "<opaque-token>",
  "deviceId": "optional-installation-id"
}
```

Refresh token одноразовый: сервер отзывает его и возвращает новую пару в той же форме `user + tokens`.
Вся refresh-family имеет абсолютный срок жизни исходного token. Повторное
предъявление уже заменённого token возвращает `refresh_token_reuse_detected` и
отзывает всю family. Access JWT принимается только пока связанная refresh-session
активна, поэтому logout и reuse detection немедленно инвалидируют и access token.

### `POST /auth/google`

```json
{
  "idToken": "<google-id-token>",
  "deviceId": "optional-installation-id",
  "referralCode": "LC-OPTIONAL"
}
```

Backend проверяет Google ID token по `GOOGLE_CLIENT_ID`, затем возвращает `user + tokens`.

### `GET /auth/yandex/start`

Query:

- `redirectUri` — optional URL из backend allowlist;
- `referralCode` — optional.
- `deviceId` — optional стабильный ID установки, рекомендуемый для привязки flow.

Возвращает подготовленные authorization URL и state. Backend создаёт одноразовый
10-минутный challenge, хранит PKCE verifier только на сервере и привязывает flow к
`deviceId` (или к User-Agent для обратной совместимости). При `/yandex/exchange`
клиент должен передать тот же `deviceId`; state нельзя использовать повторно.

### `GET /auth/yandex/callback?code=<code>&state=<state>`

Callback браузерного Yandex OAuth. Обменивает code и возвращает `user + tokens`.

### `POST /auth/yandex/exchange`

Вариант обмена для клиента:

```json
{
  "code": "<authorization-code>",
  "state": "<signed-state>",
  "deviceId": "optional-installation-id"
}
```

Ответ: `user + tokens`.

## Защищённые маршруты

Все следующие endpoints требуют Bearer access token.

### `POST /auth/logout`

```json
{
  "refreshToken": "<optional-current-refresh-token>",
  "allDevices": false
}
```

Если token не передан, сервер отзывает текущую access-token session. `allDevices: true` отзывает все сессии пользователя. Ответ `204`.

### `GET /bootstrap`

Один запрос для первого рендера приложения. Возвращает:

- `user` и server-authoritative `wallet`;
- локализованные `tasks`;
- `bonuses`;
- агрегированную `activity`;
- `referral`;
- `economy` (`unitValueCents`, `minimumWithdrawalCents`, sandbox flags);
- поддерживаемые языки и варианты копилки.

Именно bootstrap следует использовать для синхронизации локального состояния после входа.

## Профиль и настройки

### `GET /me`

Ответ: `{ "data": { "user": <serialized-user> } }`.

Wallet внутри пользователя:

```json
{
  "availableUnits": 640,
  "availableCents": 640,
  "lockedUnits": 0,
  "lockedCents": 0,
  "lifetimeEarnedUnits": 640,
  "lifetimeEarnedCents": 640,
  "referralEarnedUnits": 0,
  "referralEarnedCents": 0,
  "unitValueCents": 1,
  "currency": "USD"
}
```

### `PATCH /me`

Принимает хотя бы одно поле:

```json
{
  "name": "Aziza",
  "avatarUrl": "https://example.com/avatar.png",
  "savingsGoalCents": 250000,
  "piggyBankVariant": "safe"
}
```

`avatarUrl: null` удаляет аватар. `piggyBankVariant`: `pig`, `jar`, `safe`,
`car` или `rocket`. Клиент не может менять wallet, роль или streak.

### `GET /me/preferences`

Ответ: `{ "data": { "preferences": {} } }`.

### `PATCH /me/preferences`

```json
{
  "language": "ru",
  "theme": "light",
  "notificationsEnabled": true,
  "dailyReminderEnabled": true,
  "timezone": "Asia/Tashkent"
}
```

`theme`: `light`, `sky` или `dark`; timezone — валидная IANA timezone. Изменить
timezone на другое значение можно не чаще одного раза в 30 дней.

## Задания

### `GET /tasks`

```json
{
  "data": {
    "tasks": [
      {
        "id": "688...",
        "key": "demo_short_ad",
        "provider": "demo",
        "type": "repeatable",
        "icon": "coin",
        "title": "Быстрая награда",
        "description": "Получите награду без рекламы в MVP",
        "titleI18n": {},
        "descriptionI18n": {},
        "rewardUnits": 3,
        "rewardCents": 3,
        "cooldownSeconds": 30,
        "dailyLimit": 10,
        "state": {
          "claimsToday": 0,
          "remainingToday": 10,
          "cooldownRemainingSeconds": 0,
          "available": true,
          "lastClaimedAt": null
        }
      }
    ]
  }
}
```

### `POST /tasks/:taskIdentifier/claim`

`taskIdentifier` может быть MongoDB id либо стабильным `task.key`. В body:

```json
{
  "idempotencyKey": "task-click-unique-123"
}
```

Ключ также можно передать заголовком. Реклама в MVP не вызывается: backend сразу проверяет cooldown/daily limit, атомарно создаёт claim и начисляет награду.

Новый claim отвечает `201`, replay — `200` с `idempotentReplay: true`:

```json
{
  "data": {
    "claim": {
      "id": "688...",
      "taskKey": "demo_short_ad",
      "rewardUnits": 3,
      "rewardCents": 3,
      "status": "awarded",
      "claimedAt": "2026-07-24T12:30:00.000Z",
      "idempotencyKey": "task-click-unique-123",
      "idempotentReplay": false
    },
    "wallet": {}
  }
}
```

Production rewarded ads должны заменить `provider: demo` серверной verification-схемой; одного сообщения клиента «реклама просмотрена» недостаточно.

## Активность и бонусы

### `GET /activity?from=2026-07-01&to=2026-07-31`

Диапазон ограничен 367 днями. Ответ содержит timezone, `totalActiveDays`, grace-streak и дни:

```json
{
  "data": {
    "from": "2026-07-01",
    "to": "2026-07-31",
    "timezone": "Asia/Tashkent",
    "totalActiveDays": 12,
    "streak": {
      "activeDays": 5,
      "calendarSpanDays": 6,
      "graceDaysUsed": 1,
      "lastActiveDay": "2026-07-24"
    },
    "days": [
      {
        "dayKey": "2026-07-24",
        "actionCount": 3,
        "rewardUnits": 10
      }
    ]
  }
}
```

### `POST /activity/check-in`

Делает upsert сегодняшнего activity day и увеличивает `actionCount` при каждом вызове. Возвращает `{ "data": { "day": {} } }`.

### `GET /bonuses`

Возвращает `bonuses` с timezone/today/streak и блоками `daily`, `weekly`, `monthly`. В каждом блоке сервер вычисляет reward, eligibility и состояние claim.

### `POST /bonuses/:kind/claim`

`kind`: `daily`, `weekly` или `monthly`. Уникальный календарный bonus key делает повтор безопасным. Новый claim отвечает `201`, повтор — `200`:

```json
{
  "data": {
    "claim": {
      "id": "688...",
      "key": "daily:2026-07-24",
      "kind": "daily",
      "rewardUnits": 5,
      "rewardCents": 5,
      "claimedAt": "2026-07-24T12:30:00.000Z",
      "idempotentReplay": false
    },
    "wallet": {}
  }
}
```

## Wallet и вывод

### `GET /wallet`

Ответ: `{ "data": { "wallet": <serialized-wallet> } }`.

### `GET /wallet/ledger?cursor=<mongo-id>&limit=30`

`limit`: 1–100. Ответ содержит `entries` и nullable `nextCursor`. Entry включает `type`, `amountUnits/Cents`, `balanceAfterUnits/Cents`, описание, metadata и `createdAt`.

### `GET /withdrawals`

Возвращает:

- `sandbox: true`;
- `minimumCents`;
- `eligible`;
- текущий wallet;
- до 100 заявок со статусами.

### `POST /withdrawals`

MVP создаёт только sandbox-заявку со статусом `sandbox_pending` и перемещает
units из available в locked:

```json
{
  "amountCents": 1000,
  "method": "sandbox",
  "accountLabel": "Тестовая заявка",
  "idempotencyKey": "withdrawal-unique-123"
}
```

Новый запрос отвечает `201`, replay — `200`. `adminNotification` сообщает только статус optional Telegram-уведомления. Реальный денежный перевод не выполняется.

## Рефералы

### `GET /referrals`

Ответ `{ "data": { "referral": {} } }` содержит code/link, количество приглашённых и подтверждённых друзей, заработанные units/cents, friends и history.

### `POST /referrals/apply`

```json
{
  "code": "LCABC123"
}
```

Код применяется один раз; self-referral запрещён. Ответ возвращает обновлённый referral overview.

## Устройства и уведомления

### `GET /devices`

Возвращает сохранённые устройства и только признак `pushConfigured`, но не сам push token.

### `PUT /devices/:deviceId/preferences`

```json
{
  "platform": "android",
  "pushToken": "ExponentPushToken[...]",
  "notificationsEnabled": true,
  "dailyReminderEnabled": true,
  "reminderTime": "19:00",
  "timezone": "Asia/Tashkent"
}
```

`platform`: `android`, `ios` или `web`. `pushToken: null` удаляет token. Endpoint делает upsert и возвращает безопасную форму device.

### `DELETE /devices/:deviceId`

Удаляет регистрацию устройства. Ответ `204`.

## Важные error codes

Фактический набор расширяемый. Клиент должен как минимум обрабатывать:

- `validation_error`, `route_not_found`;
- `invalid_access_token`, `invalid_refresh_token`, `invalid_credentials`;
- `email_already_registered`, `email_not_verified`;
- `invalid_otp`, `otp_expired`, `otp_cooldown`, `otp_attempts_exceeded`,
  `invalid_registration_token`;
- `refresh_token_reuse_detected`, `timezone_change_cooldown`;
- `task_not_found`, `task_daily_limit`, `task_cooldown`, `idempotency_key_required`;
- `bonus_not_ready`;
- `referral_code_not_found`, `referral_already_applied`;
- `withdrawal_below_minimum`, `invalid_withdrawal_increment`, `insufficient_funds`;
- `rate_limit_exceeded`, `internal_error`.

## Версионирование

Новые optional-поля могут добавляться в `/api/v1` без смены версии. Удаление поля, смена его типа либо бизнес-смысла требует `/api/v2` или заранее объявленного deprecation period. Клиент игнорирует неизвестные поля, но явно обрабатывает неизвестные критические статусы.
