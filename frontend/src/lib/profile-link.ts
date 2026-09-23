import { shareLink } from "./share-link";

const PRODUCTION_ORIGIN = "https://www.logic-coin.online";

export function publicProfileUrl(referralCode: string) {
  return `${PRODUCTION_ORIGIN}/profile/${encodeURIComponent(referralCode.trim().toUpperCase())}`;
}

export function sharePublicProfile(name: string, referralCode?: string | null) {
  if (!referralCode) return Promise.resolve();
  // A new share can request a fresh social snapshot; old messages remain snapshots.
  const url = `${publicProfileUrl(referralCode)}?preview=${Math.floor(Date.now() / 60000)}`;
  return shareLink(`Logic Coin · ${name}`, `${name} в Logic Coin`, url);
}
