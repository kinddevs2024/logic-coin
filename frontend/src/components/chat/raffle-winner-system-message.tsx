import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import type { RaffleWinnerSystemEvent } from "@/lib/chat-api";
const copy = {
  ru: { title: "Победитель розыгрыша", profile: "Открыть профиль", raffle: "Розыгрыш" },
  uz: { title: "Qur’a g‘olibi", profile: "Profilni ochish", raffle: "Qur’a" },
  en: { title: "Raffle winner", profile: "Open profile", raffle: "Raffle" },
};
export function RaffleWinnerSystemMessage({ event, createdAt, onProfile, language: previewLanguage }: {
  event: RaffleWinnerSystemEvent; createdAt: string; onProfile: (id: string) => void; language?: "ru" | "uz" | "en";
}) {
  const theme = useAppTheme();
  const storedLanguage = useAppStore(s => s.language) ?? "uz";
  const language = previewLanguage ?? storedLanguage, c = copy[language];
  const accent = String(theme.success);
  const tint = /^#[a-f\d]{6}$/i.test(accent) ? `${accent}16` : theme.surface;
  const border = /^#[a-f\d]{6}$/i.test(accent) ? `${accent}55` : theme.border;
  const prize = typeof event.amountCents === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(event.amountCents / 100) : event.prizeText;
  return <View style={styles.row} testID="raffle-winner-system-message">
    <View style={[styles.card, { backgroundColor: tint, borderColor: border }]}>
      <View style={styles.heading}><Ionicons name="trophy-outline" size={18} color={String(theme.warning)} /><AppText style={styles.label} color={accent}>{c.title}</AppText></View>
      <Pressable accessibilityRole="link" accessibilityLabel={`${c.profile}: ${event.recipientName}`} hitSlop={8} onPress={() => onProfile(event.recipientId)} style={({ pressed }) => [styles.recipient, pressed && { opacity: 0.65 }]}><AppText style={styles.name}>{event.recipientName}</AppText></Pressable>
      <AppText style={styles.prize} color={accent}>{prize}</AppText>
      <AppText muted style={styles.detail}>{c.raffle}: {event.raffleTitle}</AppText>
      <AppText muted style={styles.time}>{new Date(createdAt).toLocaleTimeString(language === "uz" ? "uz-UZ" : language === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</AppText>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { width: "100%", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12 },
  card: { width: "100%", maxWidth: 360, borderRadius: 19, borderWidth: 1, paddingHorizontal: 20, paddingTop: 15, paddingBottom: 12, alignItems: "center", gap: 4 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  label: { fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  recipient: { minHeight: 34, maxWidth: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  name: { fontSize: 15, lineHeight: 21, fontWeight: "700", textAlign: "center", textDecorationLine: "underline" },
  prize: { fontSize: 27, lineHeight: 35, fontWeight: "800", textAlign: "center" },
  detail: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  time: { fontSize: 10, lineHeight: 14, marginTop: 5 },
});
