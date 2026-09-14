import { useEffect } from "react";
import { Platform } from "react-native";

import { useAppActive } from "@/hooks/use-app-active";
import { rewardedAds } from "@/lib/rewarded-ad";
import { useAppStore } from "@/store/app-store";

export function AdRuntime() {
  const hydrated = useAppStore((state) => state.hydrated);
  const authMode = useAppStore((state) => state.authMode);
  const userId = useAppStore((state) => state.user.id);
  const active = useAppActive();

  useEffect(() => {
    if (
      Platform.OS !== "android" ||
      !active ||
      !hydrated ||
      authMode !== "authenticated" ||
      !userId
    ) {
      return;
    }
    const preloadTimer = setTimeout(() => {
      void rewardedAds.initialize(userId).catch(() => false);
    }, 800);
    return () => clearTimeout(preloadTimer);
  }, [active, authMode, hydrated, userId]);

  return null;
}
