export type PaymentCardBrand = "visa" | "mastercard" | "uzcard" | "humo" | "other";

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCardNumber(value: string) {
  return digitsOnly(value).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

export function formatExpiration(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function detectCardBrand(value: string): PaymentCardBrand {
  const digits = digitsOnly(value);
  if (/^8600/.test(digits)) return "uzcard";
  if (/^9860/.test(digits)) return "humo";
  if (/^4/.test(digits)) return "visa";
  const prefix = Number(digits.slice(0, 4));
  if (/^5[1-5]/.test(digits) || (digits.length >= 4 && prefix >= 2221 && prefix <= 2720)) return "mastercard";
  return "other";
}

export function isValidCardNumber(value: string) {
  const digits = digitsOnly(value);
  if (digits.length !== 16) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

// Local card labels and dates must never be included in a payout request.
export function payoutCardDetails(card: {
  number?: string;
  savedWithdrawalId?: string;
  brand: PaymentCardBrand;
  last4: string;
}) {
  return {
    ...(card.number ? { number: digitsOnly(card.number) } : {}),
    ...(card.savedWithdrawalId ? { savedWithdrawalId: card.savedWithdrawalId } : {}),
    brand: card.brand,
    last4: card.last4,
  };
}

export function isValidExpiration(value: string, now = new Date()) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false;
  const [month, year] = value.split("/").map(Number);
  const fullYear = 2000 + year;
  const endOfMonth = new Date(fullYear, month, 0, 23, 59, 59, 999);
  return endOfMonth >= now;
}
