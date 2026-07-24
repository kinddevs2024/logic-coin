import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, type ComponentProps } from "react";

import { AppText } from "@/components/app-text";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError, bootstrapApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type LogicTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const tabMeta: Record<
  string,
  {
    label: "tabs.home" | "tabs.tasks" | "tabs.bonuses" | "tabs.profile";
    icon: ComponentProps<typeof Ionicons>["name"];
    activeIcon: ComponentProps<typeof Ionicons>["name"];
  }
> = {
  index: {
    label: "tabs.home",
    icon: "home-outline",
    activeIcon: "home",
  },
  tasks: {
    label: "tabs.tasks",
    icon: "flash-outline",
    activeIcon: "flash",
  },
  bonuses: {
    label: "tabs.bonuses",
    icon: "gift-outline",
    activeIcon: "gift",
  },
  profile: {
    label: "tabs.profile",
    icon: "person-outline",
    activeIcon: "person",
  },
};

function LogicTabBar({ state, navigation }: LogicTabBarProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabWrap,
        { bottom: Math.max(12, insets.bottom + 8) },
      ]}
    >
      <View
        accessibilityRole="tablist"
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.tabBar,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = tabMeta[route.name];
          if (!meta) return null;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={({ pressed }) => [
                styles.tab,
                focused && { backgroundColor: theme.primarySoft },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={focused ? meta.activeIcon : meta.icon}
                size={21}
                color={String(focused ? theme.primary : theme.textMuted)}
              />
              <AppText
                variant="caption"
                color={String(focused ? theme.primary : theme.textMuted)}
                numberOfLines={1}
              >
                {t(meta.label)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const syncBootstrap = useAppStore((state) => state.syncBootstrap);
  const logout = useAppStore((state) => state.logout);
  const bootstrap = useQuery({
    queryKey: ["bootstrap", accessToken],
    enabled: authMode === "authenticated" && Boolean(accessToken),
    staleTime: 60_000,
    queryFn: () => bootstrapApi.get(accessToken!),
  });

  useEffect(() => {
    if (bootstrap.data) {
      syncBootstrap(bootstrap.data);
    }
  }, [bootstrap.data, syncBootstrap]);

  useEffect(() => {
    if (
      bootstrap.error instanceof ApiError &&
      bootstrap.error.status === 401
    ) {
      logout();
      router.replace("/login");
    }
  }, [bootstrap.error, logout, router]);

  return (
    <Tabs
      tabBar={(props) => <LogicTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="bonuses" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  tabBar: {
    width: "100%",
    maxWidth: 620,
    minHeight: 70,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 7,
    flexDirection: "row",
    alignItems: "center",
    shadowOpacity: Platform.OS === "web" ? 0.14 : 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  tab: {
    flex: 1,
    minHeight: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 3,
  },
});
