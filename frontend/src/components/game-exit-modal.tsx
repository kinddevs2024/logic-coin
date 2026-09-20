import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

export function GameExitModal({ visible, title, onStay, onExit }: {
  visible: boolean;
  title: string;
  onStay: () => void;
  onExit: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onStay}
      onShow={() => {
        if (Platform.OS === "web") document.querySelector<HTMLElement>('[data-testid="game-exit-stay"]')?.focus();
      }}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View testID="game-exit-dialog" accessibilityViewIsModal accessibilityLabel="Выйти из игры?"
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="pause-outline" size={28} color={String(theme.primary)} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Выйти из игры?</Text>
          <Text style={[styles.message, { color: theme.textMuted }]}>
            Незавершённый прогресс в игре «{title}» будет потерян. При следующем входе вы начнёте заново. Результаты других игр сохранятся.
          </Text>
          <Pressable testID="game-exit-stay" accessibilityRole="button" accessibilityLabel="Остаться" onPress={onStay}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Остаться</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Выйти" onPress={onExit}
            style={({ pressed }) => [styles.button, styles.exit, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, { color: theme.textMuted }]}>Выйти</Text>
          </Pressable>
        </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(1,3,10,0.72)",
    ...(Platform.OS === "web" ? ({ position: "fixed", inset: 0, width: "100vw", height: "100dvh" } as unknown as ViewStyle) : {}),
  },
  scroll: { width: "100%", flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  card: { width: "100%", maxWidth: 400, borderRadius: 28, borderWidth: 1, padding: 24, alignItems: "center" },
  icon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  message: { fontSize: 15, lineHeight: 23, textAlign: "center", marginTop: 12, marginBottom: 24 },
  button: { width: "100%", minHeight: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  exit: { marginTop: 8 },
  pressed: { opacity: 0.75 },
});
