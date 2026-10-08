import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { ActivityIndicator, AppState, Platform, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "./app-text";
import { remainingTime } from "@/lib/home-countdown";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { adsApi } from "@/lib/api";
import { showVerifiedRewardedAd } from "@/lib/rewarded-ad-flow";
import { useAppStore } from "@/store/app-store";

export function HomeReward() {
  const token = useAppStore(s => s.accessToken);
  const focused = useIsFocused();
  const theme = useAppTheme();
  const { language } = useTranslation();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["home-ad-offer", token], queryFn: () => adsApi.challengeOffer(token!), enabled: Boolean(token) && focused, staleTime: 15000, refetchInterval: focused ? 60000 : false });
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(() => { if (AppState.currentState === "active") setNow(Date.now()); }, 1000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") { setNow(Date.now()); void query.refetch(); } });
    return () => { clearInterval(timer); listener.remove(); };
  }, [focused, query.refetch]);
  const offer = query.data;
  const time = offer ? remainingTime(offer.availableAt, offer.serverNow, query.dataUpdatedAt, now) : null;
  useEffect(() => { if (time === "00:00:00" && offer && !offer.available) void query.refetch(); }, [time, offer?.available, query.refetch]);
  const claim = async () => {
    if (lock.current || !token || !offer?.available) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const reward = await showVerifiedRewardedAd({ placement: "navigation-frequency", accessToken: token, claimCoins: true });
      if (!reward.receipt.completed || !reward.verified || reward.credited !== offer.rewardCoins) throw new Error("No reward");
      await Promise.all([client.invalidateQueries({ queryKey: ["challenges", "today", token] }), client.invalidateQueries({ queryKey: ["home-ad-offer", token] }), client.invalidateQueries({ queryKey: ["bootstrap", token] })]);
    } catch { setError(true); } finally { lock.current = false; setBusy(false); }
  };
  return <View style={{ alignItems: "center", gap: 3, maxWidth: 95 }}><Pressable accessibilityRole="button" accessibilityLabel={`+${offer?.rewardCoins ?? "…"} coin`} disabled={!offer?.available || busy || Platform.OS !== "android"} onPress={() => void claim()} style={{ flexDirection: "row", alignItems: "center", gap: 3, padding: 6, opacity: offer?.available ? 1 : 0.6 }}>
    {busy ? <ActivityIndicator /> : <Ionicons name="diamond-outline" size={22} color={theme.primary} />}<AppText style={{ fontSize: 13, fontWeight: "800" }}>+{offer?.rewardCoins ?? "…"}</AppText>
  </Pressable><AppText style={{ fontSize: 10, textAlign: "center" }}>{error ? (language === "uz" ? "Qayta urining" : "Повторите") : !offer?.eligible ? (language === "uz" ? "Chempionatni tugating" : "Завершите чемпионат") : Platform.OS !== "android" ? (language === "uz" ? "Ilovada mavjud" : "Доступно в приложении") : offer.available ? (language === "uz" ? "Olish" : "Получить") : time ?? "…"}</AppText></View>;
}
