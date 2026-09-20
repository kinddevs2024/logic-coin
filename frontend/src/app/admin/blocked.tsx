import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin", "blocked-devices"],
    queryFn: () => adminApi.blockedDevices(adminToken),
  });
  const unban = useMutation({
    mutationFn: (deviceId: string) => adminApi.unbanDevice(deviceId, adminToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "blocked-devices"] }),
  });
  const devices = query.data?.devices ?? [];
  const reset = useMutation({
    mutationFn: (deviceId: string) => adminApi.resetDevice(deviceId, adminToken),
    onSuccess: () => {
      setResetTarget(null);
      return queryClient.invalidateQueries({ queryKey: ["admin", "blocked-devices"] });
    },
  });

  return (
    <View style={styles.page}>
      <AdminPageHeader title="Заблокированные устройства" description="По умолчанию разрешены три аккаунта. Разблокировка разрешает ещё один; существующие аккаунты продолжают работать." />
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
              <AppText variant="caption" color={String(theme.danger)}>{device.reason === "registration_limit" ? "Достигнут лимит — новые аккаунты запрещены" : "Заблокировано администратором"}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Разблокировать и разрешить ещё один аккаунт"
              disabled={unban.isPending || reset.isPending}
              onPress={() => unban.mutate(device.deviceId)}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.primarySoft }, pressed && styles.pressed]}
            >
              <Ionicons name="lock-open-outline" size={17} color={String(theme.primary)} />
              <AppText variant="caption" color={String(theme.primary)}>Разрешить +1</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Удалить устройство из списка и сбросить лимит"
              disabled={unban.isPending || reset.isPending}
              onPress={() => { reset.reset(); setResetTarget(device.deviceId); }}
              style={[styles.button, { backgroundColor: `${String(theme.danger)}16` }]}>
              <Ionicons name="trash-outline" size={17} color={String(theme.danger)} />
              <AppText variant="caption" color={String(theme.danger)}>Удалить</AppText>
            </Pressable>
            {resetTarget === device.deviceId ? (
              <View style={styles.confirmation}>
                <AppText variant="label">Сбросить устройство?</AppText>
                <AppText muted>История привязок будет очищена. Снова станут доступны любые 3 аккаунта. Сами аккаунты и балансы не удаляются.</AppText>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" disabled={reset.isPending} onPress={() => setResetTarget(null)} style={[styles.button, { backgroundColor: theme.primarySoft }]}>
                    <AppText>Отмена</AppText>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={reset.isPending || unban.isPending} onPress={() => reset.mutate(device.deviceId)} style={styles.button}>
                    <AppText color={String(theme.danger)}>{reset.isPending ? "Сбрасываем…" : "Удалить и сбросить"}</AppText>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </GlassSurface>
        ))}
      </View>
      {unban.error ? <AppText color={String(theme.danger)}>{unban.error.message}</AppText> : null}
      {reset.error ? <AppText color={String(theme.danger)}>{reset.error.message}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  list: { gap: 10 },
  card: { borderRadius: 24, padding: 14, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  confirmation: { width: "100%", gap: 10, paddingTop: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0, gap: 3 },
  button: { minHeight: 40, borderRadius: 20, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 6 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
