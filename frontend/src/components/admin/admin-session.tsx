import { Redirect, useRouter } from "expo-router";
import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { LogoMark } from "@/components/logo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";

type AdminSessionContextValue = {
  adminToken: string;
  lock: () => void;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const theme = useAppTheme();
  const hydrated = useAppStore((state) => state.hydrated);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const role = useAppStore((state) => state.user.role);

  const value = useMemo<AdminSessionContextValue | null>(
    () => accessToken ? {
      adminToken: accessToken,
      lock: () => router.replace("/(tabs)"),
    } : null,
    [accessToken, router],
  );

  if (!hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <LogoMark size={64} />
        <ActivityIndicator color={String(theme.primary)} />
      </View>
    );
  }
  if (authMode !== "authenticated" || !accessToken) {
    return <Redirect href={{ pathname: "/login", params: { next: "/admin" } }} />;
  }
  if (role !== "admin") {
    return <Redirect href="/(tabs)" />;
  }
  if (!value) return null;

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return value;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
});
