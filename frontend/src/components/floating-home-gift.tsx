import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Animated, AppState, Easing, Linking, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./app-text";
import { useGlassBlurTarget } from "./glass-blur-target";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { homeGiftApi, type HomeGiftLink } from "@/lib/api";
import { showVerifiedRewardedAd } from "@/lib/rewarded-ad-flow";
import { useAppStore } from "@/store/app-store";

const INTERVAL_MS = 120_000;
const copy = {
  ru: { gift: "Подарок", close: "Закрыть", telegram: "Подпишись на Telegram · +50", ads: "Две рекламы · +75", link: "Привязать Telegram", channel: "Открыть канал", check: "Проверить", watch: "Смотреть", wait: "Подождите…", pending: "Подтверди Telegram в боте и вернись сюда.", unavailable: "Реклама не завершена или недоступна. Награда не начислена. В Expo Go реклама не работает.", inactive: "Нужен активный челлендж", failed: "Не удалось выполнить задание. Попробуй ещё раз.", login: "Войди, чтобы получить подарок" },
  en: { gift: "Gift", close: "Close", telegram: "Subscribe on Telegram · +50", ads: "Two ads · +75", link: "Link Telegram", channel: "Open channel", check: "Check", watch: "Watch", wait: "Please wait…", pending: "Confirm Telegram in the bot, then return here.", unavailable: "Ad unfinished or unavailable. No reward credited. Ads do not work in Expo Go.", inactive: "An active challenge is required", failed: "Could not complete the task. Try again.", login: "Sign in to claim gifts" },
  uz: { gift: "Sovg‘a", close: "Yopish", telegram: "Telegramga obuna · +50", ads: "Ikkita reklama · +75", link: "Telegramni bog‘lash", channel: "Kanalni ochish", check: "Tekshirish", watch: "Ko‘rish", wait: "Kutib turing…", pending: "Botda Telegramni tasdiqlang va qayting.", unavailable: "Reklama tugamadi yoki mavjud emas. Mukofot berilmadi. Expo Go’da reklama ishlamaydi.", inactive: "Faol sinov kerak", failed: "Topshiriq bajarilmadi. Qayta urinib ko‘ring.", login: "Sovg‘a uchun hisobga kiring" },
};

export function FloatingHomeGift({ active = true, bounds, blurTarget }: { active?: boolean; bounds?: { top: number; bottom: number; width?: number }; blurTarget?: RefObject<View | null> }) {
  const backgroundBlurTarget = useGlassBlurTarget();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [availableAt] = useState(() => Date.now() + INTERVAL_MS);
  const [remaining, setRemaining] = useState(INTERVAL_MS / 1000);
  const [open, setOpen] = useState(false);
  const [flight] = useState(() => new Animated.Value(0));
  const flightProgress = useRef(0);
  const [path, setPath] = useState({ from: 0.2, to: 0.8, reverse: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [linkFlow, setLinkFlow] = useState<HomeGiftLink | null>(null);
  const [telegramOpened, setTelegramOpened] = useState(false);
  const token = useAppStore(state => state.accessToken);
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const horizontalInset = Math.max(0, (width - (bounds?.width ?? width)) / 2);
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { language } = useTranslation();
  const c = copy[language];
  const running = active && focused && foreground;
  const offer = useQuery({ queryKey: ["home-gift", token], queryFn: () => homeGiftApi.offer(token!), enabled: Boolean(token) && running, refetchInterval: running ? 30_000 : false });
  const serverDeadline = offer.data ? offer.dataUpdatedAt + Math.max(0, Date.parse(offer.data.availableAt) - Date.parse(offer.data.serverNow)) : availableAt;
  const refreshRewards = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["home-gift"] }), queryClient.invalidateQueries({ queryKey: ["challenges"] }), queryClient.invalidateQueries({ queryKey: ["bootstrap"] })]);
  };
  const perform = async (task: () => Promise<void>) => {
    if (busy || !token) return;
    setBusy(true); setMessage("");
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : c.failed); }
    finally { setBusy(false); }
  };
  const checkTelegram = () => perform(async () => {
    if (!offer.data?.telegramLinked && !linkFlow) {
      const flow = await homeGiftApi.link(token!);
      setLinkFlow(flow);
      setMessage(c.pending);
      await Linking.openURL(flow.botUrl);
      return;
    }
    if (linkFlow && !offer.data?.telegramLinked) {
      const result = await homeGiftApi.finishLink(token!, linkFlow);
      if (!result.linked) { setMessage(c.pending); return; }
      setLinkFlow(null);
    }
    const result = await homeGiftApi.claimTelegram(token!);
    setMessage(`+${result.credited} coin`);
    await refreshRewards();
    setOpen(false);
  });
  const watchAds = () => perform(async () => {
    const cycle = await homeGiftApi.startAds(token!);
    for (let completed = cycle.completedAds; completed < 2; completed++) {
      const result = await showVerifiedRewardedAd({ placement: "home-gift", accessToken: token!, claimCoins: false });
      if (!result.receipt.completed || !result.verified || !result.sessionId) { setMessage(c.unavailable); await offer.refetch(); return; }
    }
    const result = await homeGiftApi.claimAds(token!, cycle.cycleId);
    setMessage(`+${result.credited} coin`);
    await refreshRewards();
    setOpen(false);
  });

  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!running) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((serverDeadline - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [running, serverDeadline]);
  useEffect(() => {
    if (!running || open || reduced) return;
    let cancelled = false;
    const listener = flight.addListener(({ value }) => { flightProgress.current = value; });
    const motion = Animated.timing(flight, { toValue: 1, duration: Math.max(1, 30000 * (1 - flightProgress.current)), easing: Easing.linear, useNativeDriver: true });
    motion.start(({ finished }) => {
      if (!finished || cancelled) return;
      flightProgress.current = 0;
      flight.setValue(0);
      setPath(previous => ({ from: Math.random(), to: Math.random(), reverse: !previous.reverse }));
    });
    return () => {
      cancelled = true;
      motion.stop();
      flight.removeListener(listener);
      flight.stopAnimation(value => { flightProgress.current = value; });
    };
  }, [running, open, reduced, flight, path]);

  if (!active || !focused) return null;
  return <>
    {!open ? <Animated.View style={[styles.flying, { top: bounds?.top ?? insets.top + 140, transform: [
      { translateX: reduced ? 12 : flight.interpolate({ inputRange: [0, 1], outputRange: path.reverse ? [width - horizontalInset + 12, -horizontalInset - 108] : [-horizontalInset - 108, width - horizontalInset + 12] }) },
      { translateY: reduced ? 0 : flight.interpolate({ inputRange: [0, 1], outputRange: [path.from, path.to].map(fraction => fraction * Math.max(0, (bounds?.bottom ?? height * 0.7) - (bounds?.top ?? insets.top + 140) - 105)) }) },
    ] }]}>
      <Animated.View style={{ overflow: "visible", transform: [{ rotate: reduced ? "0deg" : flight.interpolate({ inputRange: [0, 1], outputRange: ["-9deg", "9deg"] }) }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={c.gift} accessibilityState={{ disabled: remaining > 0 }} disabled={remaining > 0} onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.gift, pressed && styles.pressed]}>
        <View pointerEvents="none" style={styles.glass}><BlurView intensity={65} tint="default" blurTarget={blurTarget ?? backgroundBlurTarget ?? undefined} {...(Platform.OS === "android" ? { blurMethod: "dimezisBlurView" as const, blurReductionFactor: 1 } : {})} style={StyleSheet.absoluteFill} /></View>
        <MaterialCommunityIcons name={remaining > 0 ? "gift" : "gift-open"} size={46} color="#168BDA" />
        <View pointerEvents="none" style={styles.sparkle}><Ionicons name="sparkles" size={16} color="#FFDE69" /></View>
      </Pressable>
      </Animated.View>
      {remaining > 0 ? <View pointerEvents="none" style={[styles.timer, { backgroundColor: theme.surfaceRaised }]}><AppText style={styles.timerText}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</AppText></View> : null}
    </Animated.View> : null}
    {open ? <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel={c.close} accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={[styles.card, { backgroundColor: theme.surfaceRaised }]}>
          <Ionicons name="gift-outline" size={42} color={theme.primary} />
          <AppText variant="heading">{c.gift}</AppText>
          <AppText style={styles.pending}>{!token ? c.login : offer.isError ? c.failed : !offer.data ? c.wait : !offer.data.eligible ? c.inactive : offer.data.kind === "telegram" ? c.telegram : c.ads}</AppText>
          {token && offer.data?.eligible ? <>
            {offer.data.kind === "telegram" ? <>
              {!telegramOpened ? <Pressable disabled={busy} accessibilityRole="button" onPress={() => void perform(async () => { await Linking.openURL(offer.data!.channelUrl); setTelegramOpened(true); })} style={styles.close}><AppText color={String(theme.primary)}>{language === "ru" ? "Открыть Telegram" : language === "uz" ? "Telegramni ochish" : "Open Telegram"}</AppText></Pressable>
              : <Pressable disabled={busy || remaining > 0} accessibilityRole="button" onPress={checkTelegram} style={styles.close}><AppText color={String(theme.primary)}>{busy ? c.wait : language === "ru" ? "Подтвердить" : language === "uz" ? "Tasdiqlash" : "Confirm"}</AppText></Pressable>}
            </> : <Pressable disabled={busy || remaining > 0} accessibilityRole="button" onPress={watchAds} style={styles.close}><AppText color={String(theme.primary)}>{busy ? c.wait : `${c.watch} · ${offer.data.completedAds}/2`}</AppText></Pressable>}
          </> : null}
          {message ? <AppText style={styles.pending}>{message}</AppText> : null}
          <Pressable accessibilityLabel={c.close} accessibilityRole="button" disabled={busy} onPress={() => setOpen(false)} hitSlop={8} style={{ position: "absolute", top: 12, right: 12, padding: 8 }}><Ionicons name="close" size={22} color={theme.text} /></Pressable>
        </View>
      </View>
    </Modal> : null}
  </>;
}
const styles = StyleSheet.create({
  flying: { position: "absolute", left: 8, padding: 12, alignItems: "center", overflow: "visible", zIndex: 80 },
  gift: { width: 60, height: 60, alignItems: "center", justifyContent: "center", overflow: "visible" },
  glass: { ...StyleSheet.absoluteFill, borderRadius: 30, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(90,185,245,0.75)" },
  sparkle: { position: "absolute", top: -4, right: -4, width: 22, height: 22, alignItems: "center", justifyContent: "center", overflow: "visible" },
  timer: { marginTop: 5, borderRadius: 12, paddingVertical: 3, paddingHorizontal: 8, alignItems: "center" },
  timerText: { fontSize: 12, fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.8 },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" },
  card: { width: "100%", maxWidth: 360, borderRadius: 26, padding: 24, alignItems: "center", gap: 14 },
  pending: { textAlign: "center" },
  close: { padding: 12 },
});
