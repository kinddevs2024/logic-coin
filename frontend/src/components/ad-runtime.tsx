import { useEffect } from "react";

import { rewardedAds } from "@/lib/rewarded-ad";
import { useAppStore } from "@/store/app-store";

export function AdRuntime() {
  const hydrated = useAppStore((state) => state.hydrated);
  const authMode = useAppStore((state) => state.authMode);
  const userId = useAppStore((state) => state.user.id);

  useEffect(() => {
    if (!hydrated || !authMode) return;
    if (authMode === "authenticated" && !userId) return;
    void rewardedAds.initialize(userId).catch(() => false);
  }, [authMode, hydrated, userId]);

  return null;
}
