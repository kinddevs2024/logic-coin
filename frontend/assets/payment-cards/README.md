Payment-system artwork bundled locally so card previews never send entered numbers to an image service.

- Visa and Mastercard: https://github.com/aaronfagan/svg-credit-card-payment-icons (Apache-2.0; original SVGs included, PNGs rendered with Sharp).
- Uzcard: official wordmark from https://uzcard.uz/ (original SVG included).
- Humo: https://humocard.uz/bitrix/templates/main/img/logo.png (official artwork).

Brand detection identifies Visa's 4 prefix, Mastercard's 51–55 and 2221–2720 ranges, Uzcard 8600, and Humo 9860. It identifies the payment system, not issuer eligibility or bank acceptance. The form accepts exactly 16 digits as specified by the payout flow.
Reference for international ranges: https://github.com/braintree/credit-card-type/blob/main/src/lib/card-types.ts
Visual reference: https://www.untitledui.com/react/components/credit-cards (user-supplied screenshot; independently implemented using existing React Native components and app theme tokens).
