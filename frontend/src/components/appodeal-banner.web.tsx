import { useIsFocused } from "expo-router";
import { useEffect } from "react";
import { DisplayAd } from "./home-desktop-ads.web";
import { isTelegramMiniApp } from "@/lib/telegram-context";
import { loadWebsiteAds } from "@/lib/website-ads";

// Display inventory never completes a rewarded-ad session or changes coins.
export function AppodealBannerSlot({ placement }: { placement: string }) {
  const focused = useIsFocused();
  useEffect(() => {
    if (focused && placement === "challenge-result") loadWebsiteAds(true);
  }, [focused, placement]);
  if (placement !== "challenge-result" || isTelegramMiniApp()) return null;
  return (
    <div data-website-result-ads style={{ width: "100%", display: "grid", gap: 16, margin: "12px 0" }}>
      <DisplayAd slot="8329614753" horizontal focused={focused} />
      <DisplayAd slot="3467995303" horizontal focused={focused} />
    </div>
  );
}
