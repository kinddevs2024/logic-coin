import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "./app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";
import { homeApi, type HomeOverview } from "@/lib/api";
import { HomeReward } from "./home-reward";
import { remainingTime } from "@/lib/home-countdown";

export function useHomeOverview() {
  const token = useAppStore(s => s.accessToken);
  const focused = useIsFocused();
  return useQuery({ queryKey: ["home", token], queryFn: () => homeApi.get(token!), enabled: Boolean(token) && focused, staleTime: 30000, refetchInterval: focused ? 60000 : false });
}

export function HomeChampionshipStatus({ data, receivedAt, refresh }: { data: HomeOverview; receivedAt: number; refresh: () => void }) {
  const { language } = useTranslation();
  const focused = useIsFocused();
  const router = useRouter();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!focused) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (timer) clearInterval(timer); setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), 1000); };
    if (AppState.currentState === "active") start();
    const listener = AppState.addEventListener("change", state => { if (timer) clearInterval(timer); if (state === "active") { start(); refresh(); } });
    return () => { if (timer) clearInterval(timer); listener.remove(); };
  }, [focused, refresh]);
  const c = data.championship;
  const time = remainingTime(c?.endsAt ?? null, data.serverNow, receivedAt, now);
  useEffect(() => { if (time === "00:00:00") refresh(); }, [time, refresh]);
  const ended = time === "00:00:00";
  const label = language === "uz" ? (!c ? "Bugungi chempionat mavjud emas" : c.resultsPublished ? "Bugungi chempionat yakunlandi" : ended ? "Natijalar tayyorlanmoqda" : time ? `Bugungi chempionat tugashiga ${time} qoldi` : "Chempionat vaqti hali belgilanmagan")
    : language === "ru" ? (!c ? "Сегодня чемпионат недоступен" : c.resultsPublished ? "Чемпионат завершён" : ended ? "Результаты готовятся" : time ? `До конца чемпионата ${time}` : "Время чемпионата ещё не задано")
    : !c ? "No championship today" : c.resultsPublished ? "Championship completed" : ended ? "Results are being prepared" : time ? `Championship ends in ${time}` : "Deadline has not been set";
  return <View style={{ gap: 6 }}><AppText accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800" }}>{label}</AppText>{c?.resultsPublished ? <Pressable accessibilityRole="button" onPress={() => router.push("/challenges" as never)}><AppText>{language === "uz" ? "Natijalarni ko‘rish" : language === "ru" ? "Посмотреть результаты" : "View results"}</AppText></Pressable> : null}</View>;
}

export function HomeContentModal({ title, text, close }: { title: string; text: string; close: () => void }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  return <Modal visible transparent animationType="fade" onRequestClose={close}><View style={styles.backdrop}><View style={[styles.modal, { backgroundColor: theme.surfaceRaised }]}>
    <View style={styles.row}><AppText accessibilityRole="header" style={styles.heading}>{title}</AppText><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.close}><Ionicons name="close" size={24} color={theme.text} /></Pressable></View>
    <ScrollView><AppText style={{ lineHeight: 24 }}>{text || (language === "uz" ? "Ma’lumot hozircha kiritilmagan." : language === "ru" ? "Информация пока не добавлена." : "Information has not been added yet.")}</AppText></ScrollView>
  </View></View></Modal>;
}

export function HomePeriods({ data }: { data: HomeOverview }) {
  const { language } = useTranslation();
  const [open, setOpen] = useState<"weekly" | "monthly" | null>(null);
  const theme = useAppTheme();
  const labels = language === "uz" ? { weekly: "Hafta davomida yopilgan", monthly: "Oy davomida yopilgan", details: "Batafsil" } : language === "ru" ? { weekly: "Завершено за неделю", monthly: "Завершено за месяц", details: "Подробнее" } : { weekly: "Completed this week", monthly: "Completed this month", details: "Details" };
  return <View style={[styles.periods, { width: "100%" }]}>{(["weekly", "monthly"] as const).map(key => <View key={key} style={[styles.period, { borderColor: theme.border }]}>
    <AppText style={{ fontSize: 13, fontWeight: "700" }}>{labels[key]}</AppText><AppText style={styles.heading}>{data[key].completed} / {data[key].total}</AppText>
    <Pressable accessibilityRole="button" onPress={() => setOpen(key)} style={{ paddingVertical: 6 }}><AppText style={{ color: theme.primary }}>{labels.details}</AppText></Pressable>
  </View>)}{open ? <HomeContentModal title={labels[open]} text={open === "weekly" ? data.content.weeklyDetails : data.content.monthlyDetails} close={() => setOpen(null)} /> : null}</View>;
}

export function HomeSocialRules({ data }: { data?: HomeOverview }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const [rules, setRules] = useState(false);
  const title = language === "uz" ? "O‘yin qoidalari" : language === "ru" ? "Правила игры" : "Game rules";
  const openUrl = (value: string, host: string) => { try { const url = new URL(value); if (url.protocol === "https:" && (url.hostname === host || url.hostname === `www.${host}`)) void Linking.openURL(value).catch(() => undefined); } catch {} };
  return <View style={[styles.row, { justifyContent: "space-between", marginTop: 8 }]}>
    <View style={{ gap: 10 }}>{([{ icon: "logo-instagram", host: "instagram.com", url: data?.content.instagramUrl, label: "Instagram" }, { icon: "paper-plane", host: "t.me", url: data?.content.telegramUrl, label: "Telegram" }] as const).map(item => <Pressable key={item.label} accessibilityRole="link" accessibilityLabel={item.label} disabled={!item.url} onPress={() => openUrl(item.url!, item.host)} style={[styles.social, { backgroundColor: theme.primary, opacity: item.url ? 1 : 0.35 }]}><Ionicons name={item.icon} size={23} color={theme.onPrimary} /></Pressable>)}</View>
    <View style={{ gap: 10, alignItems: "center" }}><HomeReward /><Pressable accessibilityRole="button" accessibilityLabel={title} disabled={!data} onPress={() => setRules(true)} style={{ alignItems: "center", maxWidth: 85 }}><Ionicons name="information-circle-outline" size={27} color={theme.text} /><AppText style={{ fontSize: 10, textAlign: "center" }}>{title}</AppText></Pressable></View>
    {rules ? <HomeContentModal title={title} text={data?.content.rules ?? ""} close={() => setRules(false)} /> : null}
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 10 }, periods: { flexDirection: "row", gap: 10 }, period: { flex: 1, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, gap: 5 }, heading: { fontSize: 18, fontWeight: "800", flexShrink: 1 }, social: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.45)", justifyContent: "center", padding: 24 }, modal: { borderRadius: 24, padding: 20, maxHeight: "80%", gap: 16 }, close: { padding: 8 } });
