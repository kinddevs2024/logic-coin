import { shareLink } from "./share-link";
import { MIGRATED_APP_ORIGIN } from "./server-migration";

const PRODUCTION_ORIGIN = MIGRATED_APP_ORIGIN;

export function publicProfileUrl(referralCode: string) {
  return `${PRODUCTION_ORIGIN}/profile/${encodeURIComponent(referralCode.trim().toUpperCase())}`;
}

export function sharePublicProfile(name: string, referralCode?: string | null) {
  if (!referralCode) return Promise.resolve();
  // A new share can request a fresh social snapshot; old messages remain snapshots.
  const url = `${publicProfileUrl(referralCode)}?preview=${Date.now()}`;
  return shareLink(`Logic Coin · ${name}`, `${name} в Logic Coin`, url);
}
