import { Share } from "react-native";

const PRODUCTION_ORIGIN = "https://www.logic-coin.online";

export function publicProfileUrl(referralCode: string) {
  return `${PRODUCTION_ORIGIN}/profile/${encodeURIComponent(referralCode.trim().toUpperCase())}`;
}

export function sharePublicProfile(name: string, referralCode?: string | null) {
  if (!referralCode) return Promise.resolve();
  const url = publicProfileUrl(referralCode);
  return Share.share({
    title: `Logic Coin · ${name}`,
    message: `${name} в Logic Coin\n${url}`,
    url,
  });
}
