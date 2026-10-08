import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "expo-router";
import { memo, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";

export const HomeChallengeClock = memo(function HomeChallengeClock({ endsAt, onPress }: { endsAt?: string | null; onPress: () => void }) {
  const focused = useIsFocused();
  const theme = useAppTheme();
  const { language, t } = useTranslation();
  const [now, setNow] = useState(Date.now);
  const deadline = Date.parse(endsAt ?? "");
  useEffect(() => {
    if (!focused || !Number.isFinite(deadline)) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => setNow(Date.now());
    const resume = (state: string) => {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (state === "active") { update(); timer = setInterval(update, 1000); }
    };
    resume(AppState.currentState);
    const listener = AppState.addEventListener("change", resume);
    return () => { if (timer) clearInterval(timer); listener.remove(); };
  }, [focused, deadline]);
  const seconds = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const label = {
    ru: { until: "До конца челленджа", ended: "Челлендж завершён", result: "Ожидаем результаты" },
    en: { until: "Challenge ends in", ended: "Challenge ended", result: "Awaiting results" },
    uz: { until: "Sinov tugashigacha", ended: "Sinov tugadi", result: "Natijalar kutilmoqda" },
  }[language];
  const time = seconds === null ? null : [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
    <AppText numberOfLines={1} style={styles.label}>{seconds === null ? t("home.today") : seconds === 0 ? label.ended : label.until}</AppText>
    <View style={styles.right}>
      {seconds !== null && seconds > 0 ? <Ionicons name="time-outline" size={14} color={String(theme.primary)} /> : null}
      <AppText numberOfLines={1} color={String(theme.primary)} style={styles.time}>{seconds === 0 ? label.result : time ?? t("home.allChallenges")}</AppText>
      <Ionicons name="chevron-forward" size={14} color={String(theme.primary)} />
    </View>
  </Pressable>;
});
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 32, marginBottom: 13 },
  label: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  time: { fontSize: 13, fontWeight: "600", flexShrink: 1, fontVariant: ["tabular-nums"] },
});
