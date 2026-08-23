import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import type { PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAdminSession } from "@/components/admin/admin-session";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const NAV_ITEMS: { href: "/admin" | "/admin/challenges" | "/admin/budget"; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Главная", icon: "grid-outline" },
  { href: "/admin/challenges", label: "Челленджи", icon: "game-controller-outline" },
  { href: "/admin/budget", label: "Бюджет", icon: "wallet-outline" },
];

export function AdminShell({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { isDesktop } = useResponsiveLayout();
  const { lock } = useAdminSession();

  const navigation = NAV_ITEMS.map((item) => {
    const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
    return (
      <Pressable
        key={item.href}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        onPress={() => router.replace(item.href as never)}
        style={({ pressed }) => [
          styles.navItem,
          active && { backgroundColor: theme.primarySoft },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name={item.icon} size={20} color={String(active ? theme.primary : theme.textMuted)} />
        <AppText variant="label" color={String(active ? theme.primary : theme.text)}>{item.label}</AppText>
      </Pressable>
    );
  });

  return (
    <AppFrame wide contentStyle={styles.frame}>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Вернуться в приложение" onPress={() => router.replace("/(tabs)" as never)} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={String(theme.text)} />
        </Pressable>
        <View style={styles.brand}>
          <View style={[styles.brandIcon, { backgroundColor: theme.primary }]}><Ionicons name="shield-checkmark" size={19} color="#FFFFFF" /></View>
          <View>
            <AppText variant="heading">Logic Coin Admin</AppText>
            <AppText variant="caption" muted>Управление продуктом</AppText>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Заблокировать админку" onPress={lock} style={({ pressed }) => [styles.lockButton, { borderColor: theme.border }, pressed && styles.pressed]}>
          <Ionicons name="lock-closed-outline" size={18} color={String(theme.textMuted)} />
          {isDesktop ? <AppText variant="caption" muted>Выйти</AppText> : null}
        </Pressable>
      </View>

      <View style={[styles.workspace, isDesktop && styles.workspaceDesktop]}>
        {isDesktop ? (
          <GlassSurface variant="strong" intensity={72} style={styles.sidebar}>
            <AppText style={[styles.navLabel, { color: theme.textMuted }]}>РАЗДЕЛЫ</AppText>
            {navigation}
            <View style={styles.sidebarSpacer} />
            <View style={[styles.securityNote, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={String(theme.primary)} />
              <AppText variant="caption" color={String(theme.primary)} style={styles.securityText}>Защищённая сессия</AppText>
            </View>
          </GlassSurface>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNav}>
            {navigation}
          </ScrollView>
        )}
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>{children}</View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  frame: { maxWidth: 1320, paddingTop: 10 },
  topbar: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.42)" },
  brand: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  lockButton: { minHeight: 42, borderRadius: 21, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.26)" },
  workspace: { gap: 14 },
  workspaceDesktop: { flexDirection: "row", alignItems: "flex-start", gap: 18 },
  sidebar: { width: 224, minHeight: 520, borderRadius: 28, padding: 12, gap: 5 },
  navLabel: { fontSize: 10, lineHeight: 13, fontWeight: "900", letterSpacing: 1.4, paddingHorizontal: 12, marginVertical: 8 },
  navItem: { minHeight: 48, borderRadius: 16, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  mobileNav: { gap: 7, paddingBottom: 2 },
  sidebarSpacer: { flex: 1 },
  securityNote: { minHeight: 48, borderRadius: 16, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  securityText: { flex: 1, fontWeight: "700" },
  content: { minWidth: 0 },
  contentDesktop: { flex: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
