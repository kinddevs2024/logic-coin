# Logic Coin — Play Console checklist

## Store setup

- App or game: `App`
- App name: `Logic Coin`
- Default language: `O‘zbekcha (lotin)`; add Russian and English localized listings
- Package name: `com.kinddevs.logiccoin`
- Category: `Lifestyle`
- Price: `Free`
- Contains ads: `No` until an advertising SDK is actually added
- In-app purchases: `No`
- Target age: `13+`
- Support email: `kinddevs2024@gmail.com`
- Privacy policy: `https://logic-coin.vercel.app/privacy`
- Account deletion: `https://logic-coin.vercel.app/account-deletion`

## Release

- Upload format: signed Android App Bundle `logic-coin.aab`
- Keep the APK only for direct installation and testing
- Enable Play App Signing when creating the first release
- Current Android package and future updates must keep the same package and upload key
- New submissions must target Android 15 / API 35 or newer

## Data safety draft

Confirm these answers against the exact production release before submitting:

- Account information: name, email, user/provider identifiers, optional avatar
- App activity: tasks, rewards, bonuses, activity days and referrals
- Device or other identifiers: push notification token and device identifier
- Optional payout data: selected method and account label when a withdrawal request is submitted
- Diagnostics/analytics: technical logs and de-identified usage analytics
- Data encrypted in transit: `Yes` (HTTPS)
- Users can request deletion: `Yes`
- Data sold: `No`

## Required declarations

- Complete the Data safety form even if some collection is optional
- Complete the content rating questionnaire
- Declare the notification permission used for daily reminders
- Provide app access instructions if reviewers cannot reach important authenticated screens
- Personal developer accounts created after November 13, 2023 may need closed testing before production access
