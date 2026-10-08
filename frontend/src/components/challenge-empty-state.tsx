import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";

const copy = {
  ru: { eyebrow: "Следующий челлендж", title: "Скоро новые игры", text: "Новый челлендж появится автоматически", waiting: "До запуска" },
  en: { eyebrow: "Next challenge", title: "New games coming soon", text: "The next challenge will appear automatically", waiting: "Until launch" },
  uz: { eyebrow: "Keyingi sinov", title: "Tez orada yangi o‘yinlar", text: "Yangi sinov avtomatik paydo bo‘ladi", waiting: "Boshlanishigacha" },
} as const;

function millisecondsToNextMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((part) => String(part).padStart(2, "0")).join(":");
}

export function ChallengeEmptyState({ compact = false, nextAt }: { compact?: boolean; nextAt?: string | null }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const [fallbackTarget] = useState(() => Date.now() + millisecondsToNextMidnight());
  const parsedTarget = nextAt ? Date.parse(nextAt) : NaN;
  const target = Number.isFinite(parsedTarget) ? parsedTarget : fallbackTarget;
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, target - now);
  const c = copy[language];

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => formatCountdown(remaining), [remaining]);

  return (
    <View style={[styles.root, compact && styles.compact, { backgroundColor: theme.primarySoft, borderColor: theme.glassBorder }]}>
      <View style={[styles.icon, { backgroundColor: theme.surfaceRaised }]}>
        <Ionicons name="timer-outline" size={compact ? 20 : 24} color={String(theme.primary)} />
      </View>
      <View style={styles.copy}>
        <AppText style={[styles.eyebrow, { color: theme.primary }]}>{c.eyebrow.toUpperCase()}</AppText>
        <AppText style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>{c.title}</AppText>
        {!compact ? <AppText variant="caption" muted>{c.text}</AppText> : null}
      </View>
      <View style={styles.timer}>
        <AppText style={[styles.countdown, { color: theme.text }]}>{countdown}</AppText>
        <AppText style={[styles.waiting, { color: theme.textMuted }]}>{c.waiting}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 180, borderRadius: 24, borderWidth: 1, padding: 18, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  compact: { minHeight: 82, borderRadius: 20, padding: 11 },
  icon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontSize: 8, lineHeight: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "900" },
  titleCompact: { fontSize: 14, lineHeight: 18 },
  timer: { alignItems: "flex-end", gap: 2 },
  countdown: { fontSize: 19, lineHeight: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  waiting: { maxWidth: 86, fontSize: 8, lineHeight: 10, fontWeight: "700", textAlign: "right" },
});
