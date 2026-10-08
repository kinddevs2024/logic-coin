import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifyManager, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { adsApi } from "@/lib/api";
import { offerDelay, OFFER_COOLDOWN_MS, useChallengeAdGate } from "@/lib/challenge-ad-offer";
import { showVerifiedRewardedAd } from "@/lib/rewarded-ad-flow";
import { useAppStore } from "@/store/app-store";
import type { TodayChallenges } from "@/types";

const COPY = {
  ru: { title: "+45 коинов за рекламу", body: "Досмотрите видео: +45 коинов.\nКоины идут в рейтинг челленджа.\nПовторить можно через 5 минут.", watch: "Смотреть рекламу · +45 коинов", skip: "Не сейчас", error: "Награда не получена. Попробуйте позже." },
  en: { title: "+45 coins for a video", body: "Watch the full ad to earn 45 coins.\nThey count toward the challenge ranking.\nAnother reward is available in 5 minutes.", watch: "Watch ad · +45 coins", skip: "Not now", error: "No reward received. Please try again later." },
  uz: { title: "Reklama uchun +45 coin", body: "Videoni oxirigacha ko‘ring — 45 coin oling.\nUlar sinov reytingiga qo‘shiladi.\nYana 5 daqiqadan keyin olish mumkin.", watch: "Reklama ko‘rish · +45 coin", skip: "Hozir emas", error: "Mukofot olinmadi. Keyinroq urinib ko‘ring." },
};

export function ChallengeAdOffer() {
  const token = useAppStore(state => state.accessToken);
  const userId = useAppStore(state => state.user.id);
  const authenticated = useAppStore(state => state.authMode === "authenticated");
  const resultReady = useChallengeAdGate(state => state.resultReady);
  const pathname = usePathname();
  const theme = useAppTheme();
  const { language } = useTranslation();
  const copy = COPY[language];
  const client = useQueryClient();
  // Observe the existing WebSocket-fed cache; this does not request /today.
  const subscribeToday = useCallback((notify: () => void) => {
    let active = true;
    const scheduledNotify = notifyManager.batchCalls(() => { if (active) notify(); });
    const unsubscribe = client.getQueryCache().subscribe(event => {
      const key = event.query.queryKey;
      if (key[0] === "challenges" && key[1] === "today" && key[2] === token &&
          (event.type === "updated" || event.type === "removed")) scheduledNotify();
    });
    return () => { active = false; unsubscribe(); };
  }, [client, token]);
  const readToday = useCallback(() => client.getQueryData<TodayChallenges>(["challenges", "today", token]), [client, token]);
  const today = useSyncExternalStore(subscribeToday, readToday, readToday);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [wake, setWake] = useState(0);
  const [active, setActive] = useState(AppState.currentState === "active");
  const keyRef = useRef("");
  const quietRef = useRef(0);
  const allowedRoute = ["/", "/challenges", "/games", "/profile"].includes(pathname) || (pathname.startsWith("/play/") && resultReady);
  const enabled = Platform.OS === "android" && authenticated && Boolean(token) && allowedRoute;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      setActive(state === "active");
      if (state === "active" && !busyRef.current) setWake(value => value + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !active) { if (!busyRef.current) setVisible(false); return; }
    if (busyRef.current) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      try {
        const offer = await adsApi.challengeOffer(token!);
        if (disposed || busyRef.current) return;
        if (!offer.eligible || !offer.challengeSetId) { setVisible(false); return; }
        const key = `logic-coin:challenge-ad-offer:v1:${userId}:${offer.challengeSetId}`;
        const stored = Number(await AsyncStorage.getItem(key)) || 0;
        if (disposed || busyRef.current) return;
        if (keyRef.current !== key) quietRef.current = stored;
        keyRef.current = key;
        const delay = offerDelay(offer.availableAt, offer.serverNow, Math.max(stored, quietRef.current), Date.now());
        if (delay > 0) {
          setVisible(false);
          timer = setTimeout(() => setWake(value => value + 1), delay + 100);
        } else { setError(""); setVisible(true); }
      } catch { if (!disposed) setVisible(false); }
    }
    void check();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [enabled, active, token, userId, today?.dayKey, today?.revision, today?.completedCount, today?.totalCount, wake]);

  const defer = () => {
    quietRef.current = Date.now() + OFFER_COOLDOWN_MS;
    if (keyRef.current) void AsyncStorage.setItem(keyRef.current, String(quietRef.current)).catch(() => undefined);
    setVisible(false);
    setWake(value => value + 1);
  };
  const watch = async () => {
    if (busyRef.current || !token) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const reward = await showVerifiedRewardedAd({ placement: "navigation-frequency", accessToken: token, claimCoins: true });
      if (!reward.receipt.completed || !reward.verified || reward.credited !== 45) throw new Error("not_rewarded");
      defer();
      void client.invalidateQueries({ queryKey: ["challenges", "today", token] });
    } catch { setError(copy.error); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <Modal visible={visible && enabled} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busyRef.current) defer(); }}>
    <View style={styles.backdrop}><View style={[styles.card, { backgroundColor: theme.surfaceRaised }]}>
      <Ionicons name="play-circle" size={48} color={String(theme.primary)} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{copy.title}</Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>{copy.body}</Text>
      {error ? <Text accessibilityRole="alert" style={[styles.body, { color: theme.text }]}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void watch()} style={[styles.watch, { backgroundColor: theme.primary }]}>
        {busy ? <ActivityIndicator color={String(theme.onPrimary)} /> : <Text style={[styles.label, { color: theme.onPrimary }]}>{copy.watch}</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={defer} style={styles.skip}><Text style={{ color: theme.textMuted }}>{copy.skip}</Text></Pressable>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(4,12,26,0.65)" },
  card: { width: "100%", maxWidth: 390, padding: 22, borderRadius: 28, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center", marginTop: 12 },
  body: { fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 },
  watch: { width: "100%", minHeight: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 20, padding: 10 },
  label: { fontSize: 14, fontWeight: "800", textAlign: "center" }, skip: { padding: 16 },
});
