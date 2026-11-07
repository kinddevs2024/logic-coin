import { createContext, useCallback, useContext, useState, type PropsWithChildren } from "react";
import { Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authErrorCopy, isConnectionError } from "@/lib/auth-error";

type Notice = { error: unknown; retry?: () => void };
const Context = createContext<(error: unknown, retry?: () => void) => void>(() => {});
export function useAuthError() { return useContext(Context); }

export function AuthErrorProvider({ children }: PropsWithChildren) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const theme = useAppTheme();
  const { language } = useTranslation();
  const c = authErrorCopy[language];
  const show = useCallback((error: unknown, retry?: () => void) => {
    Keyboard.dismiss();
    setNotice({ error, retry });
  }, []);
  const close = () => setNotice(null);
  const connection = notice ? isConnectionError(notice.error) : false;
  const title = connection ? c.connectionTitle : c.title;
  return <Context.Provider value={show}>
    {children}
    <Modal visible={notice !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.center} bounces={false}>
          <View testID="auth-error-dialog" accessibilityViewIsModal accessibilityLabel={title} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {connection ? <Image source={require("../../assets/illustrations/connection-lost.webp")} style={styles.image} resizeMode="contain" accessible={false} /> :
              <View style={styles.errorIcon}><Ionicons name="alert-circle-outline" size={68} color={String(theme.primary)} /></View>}
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.body, { color: theme.textMuted }]}>{connection ? c.connectionBody : c.body}</Text>
            {notice?.retry ? <Pressable accessibilityRole="button" accessibilityLabel={c.retry} onPress={() => { const retry = notice.retry; close(); retry?.(); }} style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
              <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{c.retry}</Text>
            </Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={c.close} onPress={close} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <Text style={[styles.buttonText, { color: theme.textMuted }]}>{c.close}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  </Context.Provider>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,20,14,0.8)" },
  center: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: { width: "100%", maxWidth: 360, borderWidth: 1, borderRadius: 30, padding: 24, alignItems: "center" },
  image: { width: 160, height: 180, marginBottom: 16 },
  errorIcon: { height: 110, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 23, textAlign: "center", marginTop: 10, marginBottom: 22 },
  button: { width: "100%", minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.75 },
});
