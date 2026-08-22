/* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable inside gesture worklets. */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { Tabs, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
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
    label:
      | "tabs.home"
      | "tabs.challenges"
      | "tabs.games"
      | "tabs.profile";
    icon: ComponentProps<typeof Ionicons>["name"];
    activeIcon: ComponentProps<typeof Ionicons>["name"];
  }
> = {
  index: {
    label: "tabs.home",
    icon: "home-outline",
    activeIcon: "home",
  },
  challenges: {
    label: "tabs.challenges",
    icon: "flash-outline",
    activeIcon: "flash",
  },
  games: {
    label: "tabs.games",
    icon: "game-controller-outline",
    activeIcon: "game-controller",
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
  const reduceMotion = useReducedMotion();
  const visibleRoutes = useMemo(
    () => state.routes.filter((route) => Boolean(tabMeta[route.name])),
    [state.routes],
  );
  const focusedRouteKey = state.routes[state.index]?.key;
  const activeIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.key === focusedRouteKey),
  );
  const [barSize, setBarSize] = useState({ width: 0, height: 0 });
  const lensPosition = useSharedValue(activeIndex);
  const lensMorph = useSharedValue(0);
  const dragOrigin = useSharedValue(activeIndex);
  const mobileSlotWidth = Math.max(1, (barSize.width - 12) / visibleRoutes.length);

  const selectVisibleRoute = useCallback(
    (index: number) => {
      const route = visibleRoutes[index];
      if (!route) return;
      const focused = route.key === focusedRouteKey;
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    },
    [focusedRouteKey, navigation, visibleRoutes],
  );

  const clearPointerFocus = useCallback(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      lensPosition.value = activeIndex;
      lensMorph.value = 0;
      return;
    }
    lensMorph.value = 0;
    lensMorph.value = withSequence(
      withTiming(1, { duration: 145 }),
      withTiming(0, { duration: 330 }),
    );
    lensPosition.value = withSpring(activeIndex, {
      damping: 19,
      stiffness: 190,
      mass: 0.72,
      overshootClamping: false,
    });
  }, [activeIndex, lensMorph, lensPosition, reduceMotion]);

  const dragGesture = Gesture.Pan()
        .minDistance(2)
        .onBegin(() => {
          dragOrigin.value = lensPosition.value;
          lensMorph.value = reduceMotion ? 0 : withTiming(0.64, { duration: 110 });
        })
        .onUpdate((event) => {
          const step = isDesktop ? 76 : mobileSlotWidth;
          const distance = isDesktop ? event.translationY : event.translationX;
          const next = dragOrigin.value + distance / Math.max(1, step);
          lensPosition.value = Math.max(
            0,
            Math.min(visibleRoutes.length - 1, next),
          );
          if (!reduceMotion) {
            lensMorph.value = Math.min(1, 0.56 + Math.abs(distance / step) * 0.34);
          }
        })
        .onEnd(() => {
          const target = Math.max(
            0,
            Math.min(visibleRoutes.length - 1, Math.round(lensPosition.value)),
          );
          lensPosition.value = reduceMotion
            ? target
            : withSpring(target, {
                damping: 18,
                stiffness: 205,
                mass: 0.7,
              });
          lensMorph.value = reduceMotion ? 0 : withTiming(0, { duration: 280 });
          runOnJS(selectVisibleRoute)(target);
          runOnJS(clearPointerFocus)();
        })
        .onFinalize(() => {
          lensMorph.value = reduceMotion ? 0 : withTiming(0, { duration: 260 });
        });

  const lensStyle = useAnimatedStyle(() => {
    const stretch = interpolate(
      lensMorph.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const lensWidth = isDesktop ? 98 : Math.max(0, mobileSlotWidth * 1.23);
    const baseOffset = isDesktop
      ? 0
      : 6 + (mobileSlotWidth - lensWidth) / 2;
    return {
      width: lensWidth,
      height: isDesktop ? 76 : 78,
      transform: [
        {
          translateX: isDesktop
            ? 0
            : baseOffset + lensPosition.value * mobileSlotWidth,
        },
        {
          translateY: isDesktop ? lensPosition.value * 76 : 0,
        },
        {
          scaleX: isDesktop ? 1 + stretch * 0.07 : 1 + stretch * 0.16,
        },
        {
          scaleY: isDesktop ? 1 + stretch * 0.16 : 1 + stretch * 0.07,
        },
      ],
    };
  }, [isDesktop, mobileSlotWidth]);

  const refractionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      lensMorph.value,
      [0, 1],
      [0.58, 0.9],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(lensMorph.value, [0, 1], [1, 1.045]),
      },
    ],
  }));

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
      <GestureDetector gesture={dragGesture}>
        <GlassSurface
          accessibilityRole="tablist"
          intensity={74}
          variant="strong"
          onLayout={(event) => setBarSize(event.nativeEvent.layout)}
          style={[
            styles.tabBar,
            isDesktop && styles.tabBarDesktop,
            {
              borderColor: theme.glassBorder,
              shadowColor: theme.shadow,
            },
          ]}
        >
        <View pointerEvents="none" style={styles.glassHighlight} />
        {barSize.width > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.liquidLens,
              isDesktop && styles.liquidLensDesktop,
              lensStyle,
            ]}
          >
            <GlassSurface intensity={32} variant="soft" style={styles.lensSurface}>
              <LinearGradient
                pointerEvents="none"
                colors={[
                  "rgba(255,255,255,0.82)",
                  "rgba(255,255,255,0.12)",
                  "rgba(255,255,255,0.08)",
                ]}
                locations={[0, 0.44, 1]}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View
                pointerEvents="none"
                style={[styles.refractionLayer, refractionStyle]}
              />
              <View pointerEvents="none" style={styles.edgeRefraction} />
              <View pointerEvents="none" style={styles.lensGlint} />
            </GlassSurface>
          </Animated.View>
        ) : null}
        {visibleRoutes.map((route, index) => {
          const focused = activeIndex === index;
          const meta = tabMeta[route.name];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => selectVisibleRoute(index)}
              style={({ pressed }) => [
                styles.tab,
                isDesktop && styles.tabDesktop,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Animated.View
                style={[styles.tabContent, focused && styles.tabContentActive]}
              >
                <Ionicons
                  name={focused ? meta.activeIcon : meta.icon}
                  size={22}
                  color={String(focused ? theme.primary : theme.textMuted)}
                />
                <AppText
                  variant="caption"
                  color={String(focused ? theme.primary : theme.textMuted)}
                  numberOfLines={1}
                  style={focused ? styles.activeLabel : undefined}
                >
                  {t(meta.label)}
                </AppText>
              </Animated.View>
            </Pressable>
          );
        })}
        </GlassSurface>
      </GestureDetector>
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
        animation: Platform.OS === "web" ? "fade" : "shift",
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="challenges" />
      <Tabs.Screen name="games" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="tasks" options={{ href: null }} />
      <Tabs.Screen name="bonuses" options={{ href: null }} />
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
    minHeight: 74,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    shadowOpacity: Platform.OS === "web" ? 0.18 : 0.24,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
    overflow: "visible",
  },
  tabBarDesktop: {
    width: 110,
    maxWidth: 110,
    minHeight: 0,
    borderRadius: 40,
    padding: 8,
    flexDirection: "column",
    gap: 6,
  },
  liquidLens: {
    position: "absolute",
    left: 0,
    top: -2,
    zIndex: 0,
    borderRadius: radii.pill,
    shadowColor: "#8FCBFF",
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 0 24px 5px rgba(126,194,255,0.11)",
        } as ViewStyle)
      : null),
  },
  liquidLensDesktop: {
    left: 6,
    top: 5,
  },
  lensSurface: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.76)",
    backgroundColor: "rgba(255,255,255,0.2)",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "inset 0 0 18px rgba(255,255,255,0.28), inset 0 0 16px rgba(116,190,255,0.07)",
        } as ViewStyle)
      : null),
  },
  refractionLayer: {
    position: "absolute",
    inset: 0,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.055)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(7px) saturate(148%)",
          WebkitBackdropFilter: "blur(7px) saturate(148%)",
        } as unknown as ViewStyle)
      : null),
  },
  edgeRefraction: {
    position: "absolute",
    inset: 2,
    borderRadius: radii.pill,
    borderWidth: 0,
    backgroundColor: "rgba(137,201,255,0.025)",
    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "inset 0 0 15px 4px rgba(133,199,255,0.09)",
          filter: "blur(4px)",
        } as unknown as ViewStyle)
      : null),
  },
  lensGlint: {
    position: "absolute",
    left: 10,
    top: 7,
    width: "42%",
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.76)",
    transform: [{ rotate: "-6deg" }],
  },
  tab: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 3,
    overflow: "hidden",
    zIndex: 1,
    ...(Platform.OS === "web"
      ? ({ outlineStyle: "none" } as unknown as ViewStyle)
      : null),
  },
  tabDesktop: {
    flex: 0,
    width: "100%",
    minHeight: 70,
    borderRadius: 30,
    paddingHorizontal: 6,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabContentActive: { transform: [{ scale: 1.12 }] },
  activeLabel: {
    textShadowColor: "rgba(77,151,255,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  glassHighlight: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 2,
    height: 1,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.76)",
  },
  tabWrapDesktop: {
    left: 18,
    width: 110,
    top: 20,
    bottom: 20,
    justifyContent: "center",
    paddingHorizontal: 0,
  },
});
