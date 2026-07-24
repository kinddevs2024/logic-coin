# Logic Coin

Logic Coin — кроссплатформенное приложение с игровой механикой накопления. Пользователь выполняет задания, получает Logic Coin и наблюдает, как заполняется выбранная копилка. Одна кодовая база Expo работает на Android, iOS и в браузере; отдельный API хранит аккаунты, баланс, активность и заявки на вывод.

В текущем MVP реклама намеренно отключена: нажатие «Выполнить задание» сразу обращается к серверу и начисляет награду. Позже этот участок заменяется адаптером rewarded ads без изменения кошелька и API начислений.

> Важно: это демонстрационный MVP. Заявка на вывод не является автоматическим денежным переводом. Перед использованием реальных денег нужны юридическая проверка, антифрод, серверная верификация рекламных событий и подключённый платёжный провайдер.

## Структура проекта

```text
Logic-coin/
├── frontend/              # Expo SDK 57, React Native, TypeScript, Android/iOS/Web
├── backend/               # Node.js API и интеграция с MongoDB
├── api/index.ts            # Vercel entrypoint для backend
├── docs/
│   ├── architecture.md    # границы компонентов и потоки данных
│   └── api.md             # контракт REST API /api/v1
├── .github/workflows/     # CI и сборка устанавливаемого APK
├── vercel.json             # единый web + API deploy из корня
├── package.json           # npm workspaces и общие команды
└── SECURITY.md            # правила работы с секретами и деньгами
```

`frontend` и `backend` являются отдельными workspace-пакетами и не смешивают исходный код. Подробная схема находится в [docs/architecture.md](docs/architecture.md), а контракт API — в [docs/api.md](docs/api.md).

## Требования

- Node.js 22.13+ LTS, но младше Node.js 25 (минимум для Expo SDK 57);
- npm 11.x;
- для запуска на телефоне — debug APK/development build; Expo Go подходит только в совместимой с SDK 57 версии;
- для локальной нативной сборки — JDK 17 и Android SDK;
- доступная MongoDB для сохранения данных backend.

## Локальный запуск

1. Установите зависимости из корня монорепозитория:

   ```bash
   npm ci
   ```

   При первичной разработке, если lock-файл ещё не создан, используется `npm install`.

2. Создайте локальные env-файлы из безопасных шаблонов:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

   На macOS/Linux:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Заполните только локальные значения. Секреты SMTP, MongoDB, OAuth-провайдеров и Telegram должны находиться исключительно в `backend/.env` или в хранилище секретов платформы. Во frontend разрешены только переменные с префиксом `EXPO_PUBLIC_`; они попадают в клиентский bundle и не могут считаться секретными.

4. Запустите frontend и backend вместе:

   ```bash
   npm run dev
   ```

   Или по отдельности:

   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```

5. Для браузера:

   ```bash
   npm run web
   ```

Если приложение открывается на физическом телефоне, `localhost` указывает на сам телефон. В `EXPO_PUBLIC_API_URL` задайте LAN-адрес компьютера, например `http://192.168.1.20:4000/api/v1`, и разрешите этот порт в локальном firewall.

### Переменные окружения

Точные имена и значения по умолчанию описаны в `backend/.env.example` и `frontend/.env.example`. Типовое разделение:

| Где | Назначение |
| --- | --- |
| backend | адрес MongoDB, JWT/session secrets, SMTP, OAuth secrets, разрешённые CORS origins |
| frontend | публичный URL API и только публичные идентификаторы, если они действительно нужны клиенту |
| Vercel | backend-секреты в Project Environment Variables; web и API публикуются одним root-проектом |
| GitHub Actions | публичные build-time значения через Variables, постоянный Android keystore и его пароли — только через Secrets |

Никогда не коммитьте `.env`. Если ключ уже был отправлен в чат, письмо, issue или лог, считайте его раскрытым и перевыпустите у провайдера перед публикацией.

## Основные команды

| Команда | Результат |
| --- | --- |
| `npm run dev` | frontend и backend одновременно |
| `npm run web` | Expo web dev server |
| `npm run android` | запуск Expo на Android |
| `npm run build` | production-сборка обоих workspace, где предусмотрена |
| `npm run build:web` | статический web-export frontend |
| `npm run build:backend` | сборка backend |
| `npm run lint` | lint всех workspace |
| `npm run typecheck` | проверка TypeScript |
| `npm test` | тесты |
| `npm run check` | полный локальный набор проверок |

## Публикация в Vercel: один проект

Исходный код frontend и backend остаётся в разных папках, но web-версия и API
публикуются одним Vercel-проектом из корня репозитория:

- `npm run build:web` создаёт статический frontend в `frontend/dist`;
- `api/index.ts` экспортирует Express-приложение как Vercel Function;
- root `vercel.json` направляет `/api/*` в backend, а остальные URL — в Expo
  web-приложение;
- web-клиент по умолчанию использует same-origin URL `/api/v1`, поэтому отдельный
  API-домен ему не нужен.

Порядок публикации:

1. Импортируйте GitHub-репозиторий в Vercel и оставьте Root Directory корнем
   репозитория.
2. Добавьте в Project Settings → Environment Variables как минимум
   `MONGODB_URI`, `JWT_SECRET` и `OTP_PEPPER`. Два последних значения должны быть
   независимыми случайными строками длиной не менее 32 символов.
3. При включённой отправке писем добавьте `EMAIL_ENABLED=true`, `SMTP_HOST`,
   `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` и `EMAIL_FROM`. OAuth и Telegram
   включаются соответствующими backend-переменными из `backend/.env.example`.
4. Выполните Production Deploy и проверьте
   `https://<project-domain>/api/v1/health`.
5. Зарегистрируйте итоговые web origins/redirect URI в консолях Google и Yandex.
   `APP_PUBLIC_URL`, `API_PUBLIC_URL`, `CORS_ORIGINS` и
   `YANDEX_REDIRECT_URIS` можно задать явно; без них backend использует Vercel URL
   текущего/production deployment.

Секреты нельзя передавать через `vercel.json` или коммит. Файлы `.vercel/`
остаются локальными и игнорируются Git.

## Email-регистрация

`POST /auth/register` возвращает одноразовый `registrationToken` вместе со
статусом доставки шестизначного кода. Клиент временно хранит token и передаёт его
вместе с email и кодом в `POST /auth/email/verify`. Backend хранит только хеш
token; повторная незавершённая регистрация выдаёт новый token и немедленно
инвалидирует предыдущий. После успешной проверки token удаляется, а клиент
получает access/refresh session.

`POST /auth/email/resend` перевыпускает только код из письма и не создаёт новый
`registrationToken`. Полный контракт приведён в [docs/api.md](docs/api.md).

## Ограничения текущего MVP

- Task provider — `demo`: `POST /tasks/:taskIdentifier/claim` сразу начисляет
  награду после серверной проверки cooldown, дневного лимита и idempotency key.
  Рекламный SDK и rewarded-ad callback ещё не подключены.
- Все заявки на вывод являются sandbox-операциями. Backend создаёт статус
  `sandbox_pending`, переносит сумму из available в locked и не отправляет
  реальные деньги.

## APK для Android

### Готовая сборка из GitHub Actions

Workflow **Android APK** запускается вручную во вкладке Actions либо автоматически при push тега вида `v0.1.0`. Он:

- устанавливает Node.js 22 и JDK 17;
- восстанавливает зависимости workspace `frontend`;
- генерирует временный каталог `frontend/android` через Expo SDK 57;
- проверяет debug и release Gradle-сборки;
- подписывает автономный release APK постоянным PKCS#12 keystore из GitHub Secrets;
- публикует устанавливаемый файл `logic-coin.apk` и его SHA-256.

Перед запуском workflow настройте:

- Repository Variables: `EXPO_PUBLIC_API_URL` с production HTTPS URL вида
  `https://<project-domain>/api/v1` и, если используется Google login,
  `EXPO_PUBLIC_GOOGLE_CLIENT_ID`;
- Repository Secrets: `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`.

Workflow завершается с ошибкой, если production API URL или signing secrets не
заданы. Keystore должен оставаться одним и тем же для всех обновлений: APK с
другой подписью нельзя установить поверх предыдущей версии. Храните отдельную
защищённую резервную копию keystore и паролей. Наличие стабильной подписи само по
себе не означает готовность сборки к публикации в Google Play; для store-релиза
нужно отдельно настроить версионирование, AAB и Play App Signing.

После сборки скачайте artifact `logic-coin-apk`, распакуйте его и проверьте хеш:

```powershell
Get-FileHash .\logic-coin.apk -Algorithm SHA256
Get-Content .\logic-coin.apk.sha256
```

Передайте APK на Android-телефон, разрешите установку приложений из выбранного источника и откройте файл. Через ADB:

```bash
adb install -r logic-coin.apk
```

### Локальная debug-сборка для разработки

```bash
npm ci --workspace frontend
cd frontend
npx expo prebuild --platform android --no-install
cd android
```

Windows:

```powershell
.\gradlew.bat assembleDebug
```

macOS/Linux:

```bash
./gradlew assembleDebug
```

Результат находится в `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Каталоги `frontend/android` и `frontend/ios` генерируются из Expo-конфигурации и специально не коммитятся.

Debug APK ожидает запущенный Metro dev server. Для автономной установки используйте artifact из GitHub Actions.

## Проверки и безопасность

Pull request и push запускают отдельные проверки frontend/backend. Правила раскрытия уязвимостей и обязательной ротации ключей описаны в [SECURITY.md](SECURITY.md).

Лицевые балансы, награды, лимиты и решения о выводе всегда должны подтверждаться backend. Клиентская анимация не является источником истины.
