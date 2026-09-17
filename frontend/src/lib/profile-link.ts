import { Platform, Share } from "react-native";

const PRODUCTION_ORIGIN = "https://logic-coin.vercel.app";

export function publicProfileUrl(referralCode: string) {
  // This is an attribution link, not merely a public-profile link.  On
  // Android its landing page attempts the installed app before Google Play.
  const path = `/invite/${encodeURIComponent(referralCode.trim().toUpperCase())}`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return `${process.env.EXPO_PUBLIC_WEB_ORIGIN ?? PRODUCTION_ORIGIN}${path}`;
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
