import { Ionicons } from "@expo/vector-icons";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi } from "@/lib/api";

type AdminSessionContextValue = {
  adminToken: string;
  expiresAt: string;
  lock: () => void;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);
const SESSION_KEY = "logic-coin-admin-session";

type StoredSession = {
  adminToken: string;
  expiresAt: string;
};

function readStoredSession(): StoredSession | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as Partial<StoredSession>;
    if (!session.adminToken || !session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session as StoredSession;
  } catch {
    return null;
  }
}

function AdminLogin({ onUnlocked }: { onUnlocked: (session: StoredSession) => void }) {
  const theme = useAppTheme();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!password.trim() || pending) return;
    setPending(true);
    setError("");
    try {
      const session = await adminApi.login(password);
      onUnlocked(session);
      setPassword("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось открыть админку");
    } finally {
      setPending(false);
    }
  };

  return (
    <AppFrame scroll={false} contentStyle={styles.loginPage}>
      <GlassSurface intensity={82} variant="strong" style={styles.loginCard}>
        <View style={[styles.adminMark, { backgroundColor: theme.primary }]}>
          <Ionicons name="shield-checkmark" size={27} color="#FFFFFF" />
        </View>
        <View style={styles.loginCopy}>
          <AppText style={styles.eyebrow} color={String(theme.primary)}>LOGIC COIN</AppText>
          <AppText variant="title">Администрация</AppText>
          <AppText muted>Введите пароль администратора</AppText>
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={20} color={String(theme.textMuted)} />
          <TextInput
            accessibilityLabel="Пароль администратора"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => { setPassword(value); setError(""); }}
            onSubmitEditing={() => void submit()}
            placeholder="Пароль"
            placeholderTextColor={String(theme.textMuted)}
            secureTextEntry={!visible}
            value={password}
            style={[styles.passwordInput, { color: theme.text }]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Скрыть пароль" : "Показать пароль"} onPress={() => setVisible((value) => !value)} hitSlop={10}>
            <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={21} color={String(theme.textMuted)} />
          </Pressable>
        </View>
        {error ? (
          <View style={[styles.errorLine, { backgroundColor: `${String(theme.danger)}12` }]}>
            <Ionicons name="alert-circle-outline" size={18} color={String(theme.danger)} />
            <AppText variant="caption" color={String(theme.danger)} style={styles.errorCopy}>{error}</AppText>
          </View>
        ) : null}
        <AppButton onPress={() => void submit()} disabled={!password.trim()} loading={pending} icon="arrow-forward">
          Войти
        </AppButton>
        {pending ? <ActivityIndicator accessibilityLabel="Проверяем пароль" color={String(theme.primary)} /> : null}
      </GlassSurface>
    </AppFrame>
  );
}

export function AdminSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession());

  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setSession(null), Math.min(remaining, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [session]);

  const unlock = (next: StoredSession) => {
    setSession(next);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    }
  };
  const lock = () => {
    setSession(null);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  };

  const value = useMemo<AdminSessionContextValue | null>(
    () => session ? { ...session, lock } : null,
    [session],
  );

  if (!value) return <AdminLogin onUnlocked={unlock} />;
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return value;
}

const styles = StyleSheet.create({
  loginPage: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 24 },
  loginCard: { width: "100%", maxWidth: 430, borderRadius: 34, padding: 24, gap: 18 },
  adminMark: { width: 56, height: 56, borderRadius: 19, alignItems: "center", justifyContent: "center", shadowColor: "#087CFF", shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  loginCopy: { gap: 4 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: "900", letterSpacing: 1.7 },
  inputWrap: { minHeight: 56, borderRadius: 20, borderWidth: 1, borderColor: "rgba(115,145,174,0.2)", backgroundColor: "rgba(255,255,255,0.28)", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 11 },
  passwordInput: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: "700", outlineStyle: "none" } as never,
  errorLine: { minHeight: 42, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  errorCopy: { flex: 1 },
});
