/* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable inside gesture worklets. */
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Link, Redirect, Tabs, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from "react";
import {
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  StyleSheet,
  Text,
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
import { NavigationGlass } from "@/components/navigation-glass";
import { NavigationBlurProvider, NavigationBlurScene } from "@/components/navigation-blur-target";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError, bootstrapApi } from "@/lib/api";
import { showVerifiedRewardedAd } from "@/lib/rewarded-ad-flow";
import { useAppStore } from "@/store/app-store";

type LogicTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.kinddevs.logiccoin";
const NAV_AD_COUNTER_KEY = "logic-coin:appodeal-navigation-counter:v1";

function nextAdThreshold() {
  return 10 + Math.floor(Math.random() * 26);
}

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
  const { isDesktop, isWeb } = useResponsiveLayout();
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
  const [rewardOfferVisible, setRewardOfferVisible] = useState(false);
  const [rewardAdBusy, setRewardAdBusy] = useState(false);
  const accessToken = useAppStore((store) => store.accessToken);
  const setCoinBalance = useAppStore((store) => store.setCoinBalance);
  const lensPosition = useSharedValue(activeIndex);
  const lensMorph = useSharedValue(0);
  const dragOrigin = useSharedValue(activeIndex);
  const dragInProgress = useSharedValue(false);
  const lastDragEnd = useSharedValue(0);
  const mobileSlotWidth = Math.max(1, (barSize.width - 14) / visibleRoutes.length);
  const lensWidth = isDesktop ? Math.max(0, barSize.width - 18) : mobileSlotWidth;
  const lensHeight = isDesktop ? 70 : 60;

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
      if (Platform.OS === "android") {
        void AsyncStorage.getItem(NAV_AD_COUNTER_KEY).then(async (stored) => {
          const parsed = stored ? JSON.parse(stored) as { count?: number; threshold?: number } : {};
          const count = (parsed.count ?? 0) + 1;
          const threshold = parsed.threshold ?? nextAdThreshold();
          if (count >= threshold) {
            await AsyncStorage.setItem(NAV_AD_COUNTER_KEY, JSON.stringify({ count: 0, threshold: nextAdThreshold() }));
            setRewardOfferVisible(true);
          } else {
            await AsyncStorage.setItem(NAV_AD_COUNTER_KEY, JSON.stringify({ count, threshold }));
          }
        }).catch(() => undefined);
      }
    },
    [focusedRouteKey, navigation, visibleRoutes],
  );

  const watchNavigationReward = useCallback(async () => {
    if (rewardAdBusy) return;
    setRewardAdBusy(true);
    try {
      const reward = await showVerifiedRewardedAd({
        placement: "navigation-frequency",
        accessToken,
        claimCoins: true,
      });
      if (reward.receipt.completed && reward.verified) {
        if (reward.coinBalance !== undefined) setCoinBalance(reward.coinBalance);
        setRewardOfferVisible(false);
      }
    } finally {
      setRewardAdBusy(false);
    }
  }, [accessToken, rewardAdBusy, setCoinBalance]);

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
        .minDistance(12)
        .onStart(() => {
          dragInProgress.value = true;
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
        .onFinalize((_event, success) => {
          // eslint-disable-next-line react-hooks/purity -- Gesture callback runs on pointer release, not during render.
          if (dragInProgress.value) lastDragEnd.value = Date.now();
          dragInProgress.value = false;
          if (!success) {
            lensPosition.value = reduceMotion ? activeIndex : withSpring(activeIndex, { damping: 22, stiffness: 240 });
          }
          lensMorph.value = reduceMotion ? 0 : withTiming(0, { duration: 260 });
        });

  const lensStyle = useAnimatedStyle(() => {
    const stretch = interpolate(
      lensMorph.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      width: lensWidth,
      height: lensHeight,
      transform: [
        {
          translateX: isDesktop
            ? 0
            : lensPosition.value * mobileSlotWidth,
        },
        {
          translateY: isDesktop ? lensPosition.value * 76 : 0,
        },
        {
          scaleX: isDesktop ? 1 + stretch * 0.025 : 1 + stretch * 0.08,
        },
        {
          scaleY: isDesktop ? 1 + stretch * 0.08 : 1 + stretch * 0.025,
        },
      ],
    };
  }, [isDesktop, lensWidth, lensHeight, mobileSlotWidth]);

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
        <View
          collapsable={false}
          accessibilityRole="tablist"
          aria-orientation={isDesktop ? "vertical" : "horizontal"}
          onLayout={({ nativeEvent: { layout } }) => setBarSize((current) =>
            current.width === layout.width && current.height === layout.height
              ? current : { width: layout.width, height: layout.height })}
          style={[
            styles.tabBar,
            isDesktop && styles.tabBarDesktop,
            {
              shadowColor: theme.shadow,
            },
          ]}
        >
        <NavigationGlass width={barSize.width} height={barSize.height} />
        {barSize.width > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.liquidLens,
              isDesktop && styles.liquidLensDesktop,
              lensStyle,
            ]}
          >
            <NavigationGlass variant="lens" width={lensWidth} height={lensHeight} />
          </Animated.View>
        ) : null}
        {visibleRoutes.map((route, index) => {
          const focused = activeIndex === index;
          const meta = tabMeta[route.name];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={t(meta.label)}
              accessibilityState={{ selected: focused }}
              aria-selected={focused}
              {...(isWeb ? {
                tabIndex: focused ? 0 : -1,
                onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                  const previous = isDesktop ? "ArrowUp" : "ArrowLeft";
                  const next = isDesktop ? "ArrowDown" : "ArrowRight";
                  let target: number;
                  if (event.key === previous) target = (index - 1 + visibleRoutes.length) % visibleRoutes.length;
                  else if (event.key === next) target = (index + 1) % visibleRoutes.length;
                  else if (event.key === "Home") target = 0;
                  else if (event.key === "End") target = visibleRoutes.length - 1;
                  else return;
                  event.preventDefault();
                  selectVisibleRoute(target);
                  event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
                },
              } : {})}
              onPress={() => {
                // RN Web can dispatch a synthetic click on the original tab
                // after its pointer was released at the end of a pan gesture.
                if (dragInProgress.value || Date.now() - lastDragEnd.value < 250) return;
                selectVisibleRoute(index);
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
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
                  style={[styles.tabLabel, focused && styles.activeLabel]}
                >
                  {t(meta.label)}
                </AppText>
              </Animated.View>
            </Pressable>
          );
        })}
        </View>
      </GestureDetector>
      {isDesktop && isWeb ? (
        <Link href={PLAY_STORE_URL} target="_blank" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Скачать Logic Coin в Google Play"
            accessibilityHint="Откроет страницу приложения в новой вкладке"
            style={({ pressed }) => [
              styles.playStoreLink,
              pressed && styles.playStoreLinkPressed,
            ]}
          >
            <Image
              source={require("../../../assets/store/google-play-ru.png")}
              resizeMode="contain"
              style={styles.playStoreBadge}
            />
          </Pressable>
        </Link>
      ) : null}
      <Modal visible={rewardOfferVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.adOfferBackdrop}>
          <GlassSurface intensity={76} variant="strong" style={styles.adOfferCard}>
            <View style={styles.adOfferIcon}><Ionicons name="play" size={26} color="#FFFFFF" /></View>
            <Text style={styles.adOfferTitle}>Получить 25 coin?</Text>
            <Text style={styles.adOfferText}>Посмотрите короткое видео. Награда начислится после полного просмотра.</Text>
            <Pressable disabled={rewardAdBusy} onPress={() => void watchNavigationReward()} style={({ pressed }) => [styles.adOfferPrimary, pressed && styles.playStoreLinkPressed]}>
              {rewardAdBusy ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="play-circle" size={21} color="#FFFFFF" /><Text style={styles.adOfferPrimaryText}>Смотреть</Text></>}
            </Pressable>
            <Pressable disabled={rewardAdBusy} onPress={() => setRewardOfferVisible(false)} style={styles.adOfferSkip}><Text style={styles.adOfferSkipText}>Не сейчас</Text></Pressable>
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const hydrated = useAppStore((state) => state.hydrated);
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

  if (!hydrated) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator />
      </View>
    );
  }
  if (authMode !== "authenticated" || !accessToken) {
    return <Redirect href="/login" />;
  }

  return (
    <NavigationBlurProvider>
    <Tabs
      tabBar={(props) => <LogicTabBar {...props} />}
      screenLayout={({ children }) => <NavigationBlurScene>{children}</NavigationBlurScene>}
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
    </NavigationBlurProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
    maxWidth: 520,
    minHeight: 74,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "transparent",
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: "visible",
    ...(Platform.OS === "web" ? ({ boxShadow: "0 8px 32px rgba(23,62,104,0.14), 0 2px 6px rgba(23,62,104,0.05)", touchAction: "none" } as unknown as ViewStyle) : null),
  },
  tabBarDesktop: {
    width: 110,
    maxWidth: 110,
    minHeight: 0,
    borderRadius: 38,
    padding: 8,
    flexDirection: "column",
    gap: 6,
  },
  liquidLens: {
    position: "absolute",
    left: 6,
    top: 6,
    zIndex: 0,
    borderRadius: radii.pill,
    shadowColor: "#5185AE",
    shadowOpacity: 0.14,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 2 },
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 2px 10px rgba(40,92,140,0.13)",
        } as ViewStyle)
      : null),
  },
  liquidLensDesktop: {
    left: 8,
    top: 8,
  },
  tab: {
    flex: 1,
    height: 60,
    minHeight: 60,
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
    height: 70,
    minHeight: 70,
    borderRadius: 30,
    paddingHorizontal: 6,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabContentActive: { transform: [{ scale: 1.04 }] },
  tabLabel: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  activeLabel: {
    textShadowColor: "rgba(77,151,255,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  tabWrapDesktop: {
    left: 18,
    width: 110,
    top: 20,
    bottom: 20,
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  playStoreLink: {
    position: "absolute",
    left: -6,
    bottom: 0,
    width: 122,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          transition: "transform 160ms ease, opacity 160ms ease",
        } as unknown as ViewStyle)
      : null),
  },
  playStoreLinkPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  playStoreBadge: {
    width: 118,
    height: 46,
  },
  adOfferBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(4,12,26,0.52)" },
  adOfferCard: { width: "100%", maxWidth: 360, alignItems: "center", borderRadius: 32, padding: 24, overflow: "hidden" },
  adOfferIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#147DFF" },
  adOfferTitle: { marginTop: 16, color: "#0D1B35", fontSize: 23, fontWeight: "900" },
  adOfferText: { marginTop: 8, color: "#5D6C83", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  adOfferPrimary: { marginTop: 20, width: "100%", minHeight: 54, borderRadius: 18, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#147DFF" },
  adOfferPrimaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  adOfferSkip: { paddingHorizontal: 18, paddingVertical: 13 },
  adOfferSkipText: { color: "#65758B", fontSize: 13, fontWeight: "800" },
});
