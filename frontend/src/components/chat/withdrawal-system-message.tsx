import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import type { WithdrawalSystemEvent } from "@/lib/chat-api";

const copy = {
  ru: { approved: "Вывод одобрен", detail: "Администрация одобрила заявку на вывод", profile: "Открыть профиль" },
  uz: { approved: "Pul yechish tasdiqlandi", detail: "Ma’muriyat pul yechish so‘rovini tasdiqladi", profile: "Profilni ochish" },
  en: { approved: "Withdrawal approved", detail: "The administration approved the withdrawal request", profile: "Open profile" },
};
export function WithdrawalSystemMessage({ event, createdAt, onProfile }: {
  event: WithdrawalSystemEvent; createdAt: string; onProfile: (id: string) => void;
}) {
  const theme = useAppTheme();
  const language = useAppStore(s => s.language) ?? "uz";
  const c = copy[language];
  const success = String(theme.success);
  const tint = /^#[a-f\d]{6}$/i.test(success) ? `${success}16` : theme.surface;
  const border = /^#[a-f\d]{6}$/i.test(success) ? `${success}55` : theme.border;
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(event.amountCents / 100);
  return <View style={styles.row} testID="withdrawal-system-message">
    <View style={[styles.card, { backgroundColor: tint, borderColor: border }]}>
      <View style={styles.heading}>
        <Ionicons name="checkmark-circle-outline" size={16} color={success} />
        <AppText style={styles.label} color={success}>{c.approved}</AppText>
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel={`${c.profile}: ${event.recipientName}`} onPress={() => onProfile(event.recipientId)} hitSlop={8} style={({ pressed }) => [styles.recipient, pressed && { opacity: 0.65 }]}>
        <AppText style={styles.name}>{event.recipientName}</AppText>
      </Pressable>
      <AppText style={styles.amount} color={success}>{amount}</AppText>
      <AppText muted style={styles.detail}>{c.detail}</AppText>
      <AppText muted style={styles.time}>{new Date(createdAt).toLocaleTimeString(language === "uz" ? "uz-UZ" : language === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</AppText>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { width: "100%", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12 },
  card: { maxWidth: 360, width: "100%", borderRadius: 19, borderWidth: 1, paddingHorizontal: 20, paddingTop: 15, paddingBottom: 12, alignItems: "center", gap: 4 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  label: { fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "center" },
  recipient: { minHeight: 34, alignItems: "center", justifyContent: "center", maxWidth: "100%", paddingHorizontal: 4 },
  name: { fontSize: 15, lineHeight: 21, fontWeight: "700", textAlign: "center", textDecorationLine: "underline" },
  amount: { fontSize: 29, lineHeight: 38, fontWeight: "800", textAlign: "center" },
  detail: { fontSize: 11, lineHeight: 16, textAlign: "center" },
  time: { fontSize: 10, lineHeight: 14, marginTop: 4 },
});
