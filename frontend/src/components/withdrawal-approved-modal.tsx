import { useUiCopy } from "@/components/localized-native";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { inboxApi, type InboxNotification } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export function WithdrawalApprovedModal() {
  const { copyText, copyContent } = useUiCopy();
  const theme = useAppTheme();
  const token = useAppStore(state => state.accessToken);
  const authenticated = useAppStore(state => state.authMode === "authenticated");
  const client = useQueryClient();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["withdrawal-approval-notice", token],
    enabled: authenticated && Boolean(token), refetchInterval: 30_000,
    queryFn: async () => {
      let cursor: { date: string; id: string } | null = null;
      const notices: InboxNotification[] = [];
      // Scan unread pages so a busy inbox cannot hide an approval notice.
      do {
        const page = await inboxApi.list(token!, false, cursor);
        notices.push(...page.items.filter(item => item.kind === "withdrawal_approved"));
        cursor = page.next;
      } while (cursor && notices.length === 0);
      return notices;
    },
  });
  const notice = authenticated ? query.data?.find(item => !dismissed.includes(item.id)) : undefined;
  const dismiss = () => {
    if (!notice || !token) return;
    setDismissed(ids => [...ids, notice.id]);
    void inboxApi.read(token, [notice.id]).then(() => {
      void client.invalidateQueries({ queryKey: ["inbox"] });
    }).catch(() => {
      // Retry acknowledgement on the next visit; never claim it was persisted.
    });
  };
  return (
    <Modal visible={Boolean(notice)} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: theme.surface }]}>
          <Ionicons name="checkmark-circle" size={64} color={theme.primary} />
          <AppText style={[styles.title, { color: theme.text }]}>{copyContent(notice?.title)}</AppText>
          <AppText style={[styles.body, { color: theme.textMuted }]}>{copyContent(notice?.body)}</AppText>
          <Pressable accessibilityRole="button" onPress={dismiss} style={[styles.button, { backgroundColor: theme.primary }]}>
            <AppText style={{ color: theme.onPrimary }}>{copyText("OK")}</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 420, borderRadius: 28, padding: 28, gap: 16, alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  button: { minHeight: 48, width: "100%", alignItems: "center", justifyContent: "center", borderRadius: 16 },
});
