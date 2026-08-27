import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";

import { useAdminSession } from "@/components/admin/admin-session";
import { AdminDataState, AdminPageHeader } from "@/components/admin/admin-ui";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi } from "@/lib/api";

export default function BlockedDevicesScreen() {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const { adminToken } = useAdminSession();
  const query = useQuery({
    queryKey: ["admin", "blocked-devices"],
    queryFn: () => adminApi.blockedDevices(adminToken),
  });
  const unban = useMutation({
    mutationFn: (deviceId: string) => adminApi.unbanDevice(deviceId, adminToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "blocked-devices"] }),
  });
  const devices = query.data?.devices ?? [];

  return (
    <View style={styles.page}>
      <AdminPageHeader title="Заблокированные устройства" description="Автоматические блокировки после регистрации более трёх аккаунтов" />
      <AdminDataState loading={query.isPending} error={query.error} empty={!query.isPending && !query.error && devices.length === 0} emptyText="Заблокированных устройств нет" onRetry={() => void query.refetch()} />
      <View style={styles.list}>
        {devices.map((device) => (
          <GlassSurface key={device.id} intensity={66} variant="strong" style={styles.card}>
            <View style={[styles.icon, { backgroundColor: `${String(theme.danger)}16` }]}>
              <Ionicons name="phone-portrait-outline" size={22} color={String(theme.danger)} />
            </View>
            <View style={styles.body}>
              <AppText variant="label" numberOfLines={1}>{device.deviceId}</AppText>
              <AppText variant="caption" muted>{device.registrationCount} регистраций · {device.accountCount} аккаунтов</AppText>
              <AppText variant="caption" muted>{device.users.map((user) => user.email).join(", ") || "Аккаунты не найдены"}</AppText>
              <AppText variant="caption" color={String(theme.danger)}>{device.reason === "registration_limit" ? "Превышен лимит регистраций" : "Заблокировано администратором"}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Разблокировать устройство"
              disabled={unban.isPending}
              onPress={() => unban.mutate(device.deviceId)}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.primarySoft }, pressed && styles.pressed]}
            >
              <Ionicons name="lock-open-outline" size={17} color={String(theme.primary)} />
              <AppText variant="caption" color={String(theme.primary)}>Разбанить</AppText>
            </Pressable>
          </GlassSurface>
        ))}
      </View>
      {unban.error ? <AppText color={String(theme.danger)}>{unban.error.message}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  list: { gap: 10 },
  card: { borderRadius: 24, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0, gap: 3 },
  button: { minHeight: 40, borderRadius: 20, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 6 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
