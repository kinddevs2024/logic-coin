import { shareLink } from "./share-link";

const PRODUCTION_ORIGIN = "https://www.logic-coin.online";

export function publicProfileUrl(referralCode: string) {
  return `${PRODUCTION_ORIGIN}/profile/${encodeURIComponent(referralCode.trim().toUpperCase())}`;
}

export function sharePublicProfile(name: string, referralCode?: string | null) {
  if (!referralCode) return Promise.resolve();
  const url = publicProfileUrl(referralCode);
  return shareLink(`Logic Coin · ${name}`, `${name} в Logic Coin`, url);
}
