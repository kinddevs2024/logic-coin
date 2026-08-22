# Google Play publication pack

Готовые файлы находятся в каталоге `google-play`.

## Основные параметры

- App name: `Logic Coin`
- Package name: `com.kinddevs.logiccoin`
- Version: `1.0.0`
- Privacy policy: `https://logic-coin.vercel.app/privacy`
- Account deletion: `https://logic-coin.vercel.app/account-deletion`
- Support email: `kinddevs2024@gmail.com`

## Графика

- `app-icon-512.png` — 512×512, PNG, менее 1 МБ.
- `feature-graphic-1024x500.png` — обязательная обложка 1024×500, PNG без прозрачности.
- `phone/*.png` — пять снимков телефона 1080×1920, 9:16.
- `tablet/*.png` — пять снимков планшета 1440×2560, 9:16.
- `manifest.json` — размеры, режим цвета, вес и SHA-256 каждого файла.

Снимки показывают реальный интерфейс приложения без рамок устройств и рекламных надписей. Формат 9:16 выбран по рекомендациям Google Play. Размеры из предоставленного примера 1242×2688 и 2064×2752 относятся к другой сетке публикации и не использованы как финальные Play-ассеты.

## Тексты

- `listing-uz.md` — готовая узбекская локализация.
- `listing-ru.md` — готовая русская локализация.
- `privacy-policy.md` — текст опубликованной политики.
- `play-console-checklist.md` — рекомендуемые параметры Play Console, Data safety и release checklist.
- `release-notes.md` — готовые примечания к версии 1.0.0 на трёх языках.

## Повторный экспорт

Запустите `export_assets.py` через Python с Pillow. Скрипт пересобирает финальные PNG из реальных снимков интерфейса и обновляет manifest.

Исходные кадры лежат в `source-captures`: телефон снят при viewport 432×768, планшет — 864×1536. Финальные изображения экспортируются с качественным масштабированием в 9:16.

Официальные требования: https://support.google.com/googleplay/android-developer/answer/9866151
