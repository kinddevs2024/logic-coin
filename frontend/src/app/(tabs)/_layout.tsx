import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, type ComponentProps } from "react";
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
} from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
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
  const { isDesktop } = useResponsiveLayout();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabWrap,
        isDesktop
          ? styles.tabWrapDesktop
          : [
              styles.tabWrapMobile,
              { bottom: Math.max(12, insets.bottom + 8) },
            ],
      ]}
    >
      <GlassSurface
        accessibilityRole="tablist"
        intensity={74}
        variant="strong"
        style={[
          styles.tabBar,
          isDesktop && styles.tabBarDesktop,
          {
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
                isDesktop && styles.tabDesktop,
                pressed && { opacity: 0.7 },
              ]}
            >
              {focused ? (
                <Animated.View
                  entering={FadeIn.duration(180).reduceMotion(
                    ReduceMotion.System,
                  )}
                  exiting={FadeOut.duration(140).reduceMotion(
                    ReduceMotion.System,
                  )}
                  style={[
                    styles.activePill,
                    isDesktop && styles.activePillDesktop,
                    {
                      backgroundColor: theme.primarySoft,
                      borderColor: theme.glassBorder,
                    },
                  ]}
                />
              ) : null}
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
      </GlassSurface>
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
    alignItems: "center",
    paddingHorizontal: 14,
  },
  tabWrapMobile: {
    left: 0,
    right: 0,
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
    overflow: "hidden",
  },
  tabBarDesktop: {
    width: 92,
    maxWidth: 92,
    minHeight: 0,
    borderRadius: 32,
    padding: 8,
    flexDirection: "column",
    gap: 6,
  },
  tab: {
    flex: 1,
    minHeight: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 3,
    overflow: "hidden",
  },
  tabDesktop: {
    flex: 0,
    width: "100%",
    minHeight: 70,
    borderRadius: 22,
    paddingHorizontal: 6,
  },
  activePill: {
    position: "absolute",
    inset: 0,
    borderWidth: 1,
    borderRadius: 17,
  },
  activePillDesktop: {
    borderRadius: 22,
  },
  tabWrapDesktop: {
    left: 18,
    width: 92,
    top: 20,
    bottom: 20,
    justifyContent: "center",
    paddingHorizontal: 0,
  },
});
