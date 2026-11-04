import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, AppState, Linking, Modal, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { inboxApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

const copy = {
  ru: { title: "Поздравляем! 🎉", body: "Вы выиграли в розыгрыше Logic Coin! 🏆\nНапишите нашему боту и отправьте номер телефона или контакт для связи — команда поможет получить приз. 🎁", contact: "Связаться с командой", close: "Закрыть поздравление", retry: "Не удалось сохранить. Попробуйте ещё раз." },
  uz: { title: "Tabriklaymiz! 🎉", body: "Siz Logic Coin sovrinli o‘yinida yutdingiz! 🏆\nSovrinni olish uchun botimizga yozib, telefon raqamingizni yoki bog‘lanish uchun kontaktingizni yuboring. 🎁", contact: "Jamoa bilan bog‘lanish", close: "Tabrikni yopish", retry: "Saqlab bo‘lmadi. Qayta urinib ko‘ring." },
  en: { title: "Congratulations! 🎉", body: "You won in the Logic Coin prize draw! 🏆\nMessage our bot with your phone number or contact details so our team can help you receive your prize. 🎁", contact: "Contact the team", close: "Close congratulations", retry: "Could not save. Please try again." },
};

type Notice = { id: string; round: number; amountCents: number };
function WinnerDialog({ notice, token }: { notice: Notice; token: string }) {
  const theme = useAppTheme();
  const language = useAppStore(s => s.language) ?? "uz";
  const c = copy[language];
  const client = useQueryClient();
  const [seconds, setSeconds] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    // Only time spent in the foreground counts towards reading the notice.
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setSeconds(value => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const close = async () => {
    if (seconds > 0 || saving) return;
    setSaving(true); setError(false);
    try {
      await inboxApi.acknowledgeRaffleWin(token, notice.id);
      client.setQueryData(["raffle-win-notice", token], null);
      void client.invalidateQueries({ queryKey: ["raffle-win-notice", token] });
    } catch { setError(true); setSaving(false); }
  };
  return <Modal transparent visible animationType="fade" onRequestClose={() => { void close(); }}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={c.close} accessibilityState={{ disabled: seconds > 0 || saving }} disabled={seconds > 0 || saving} onPress={() => { void close(); }} style={styles.close}>
          <AppText style={{ fontSize: 25, opacity: seconds > 0 ? 0.4 : 1 }}>×</AppText>
          {seconds > 0 || saving ? <ActivityIndicator size="small" color={theme.primary} /> : null}
          {seconds > 0 ? <AppText>{seconds}</AppText> : null}
        </Pressable>
        <AppText style={styles.trophy}>🏆</AppText>
        <AppText style={[styles.title, { color: theme.text }]}>{c.title}</AppText>
        <AppText style={[styles.amount, { color: theme.primary }]}>${(notice.amountCents / 100).toFixed(2)}</AppText>
        <AppText style={[styles.body, { color: theme.textMuted }]}>{c.body}</AppText>
        <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL("https://t.me/Logic_coinn_bot").catch(() => setError(true)); }} style={[styles.button, { backgroundColor: theme.primary }]}>
          <AppText style={{ color: theme.onPrimary, fontWeight: "700" }}>{c.contact}</AppText>
        </Pressable>
        {error ? <AppText accessibilityRole="alert" style={{ color: theme.danger }}>{c.retry}</AppText> : null}
      </View>
    </View>
  </Modal>;
}

export function RaffleWinNotice() {
  const token = useAppStore(s => s.accessToken);
  const authenticated = useAppStore(s => s.authMode === "authenticated");
  const query = useQuery({ queryKey: ["raffle-win-notice", token], enabled: authenticated && Boolean(token),
    queryFn: () => inboxApi.raffleWin(token!), staleTime: 60_000, refetchInterval: 60_000 });
  return authenticated && token && query.data ? <WinnerDialog key={`${token}:${query.data.id}`} notice={query.data} token={token} /> : null;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,.65)" },
  card: { width: "100%", maxWidth: 430, borderRadius: 30, padding: 28, paddingTop: 55, gap: 16, alignItems: "center", borderWidth: 2 },
  close: { position: "absolute", top: 10, right: 10, minWidth: 44, minHeight: 44, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  trophy: { fontSize: 60 }, title: { fontSize: 25, fontWeight: "800", textAlign: "center" },
  amount: { fontSize: 42, fontWeight: "800" }, body: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  button: { minHeight: 50, padding: 14, borderRadius: 26, width: "100%", alignItems: "center", justifyContent: "center" },
});
