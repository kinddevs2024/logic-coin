import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  AppState,
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { AndroidSoftGlow } from "@/components/android-soft-glow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatMoney } from "@/lib/format";
import { androidImageProps } from "@/lib/android-image";
import { useAppStore } from "@/store/app-store";
import { sceneAssets } from "@/lib/scene-assets";
import { getSavingsSceneLayout } from "@/lib/savings-scene-layout";
import { pendingSavingsCash } from "@/lib/savings-cash-animation";

const jarStateSources = sceneAssets.jars;

const moneyDrops: {
  source: ImageSourcePropType;
  size: number;
  startX: number;
  startY: number;
  bendX: number;
  rotation: number;
  delay: number;
}[] = [
  {
    source: sceneAssets.coins[0],
    size: 48,
    startX: -150,
    startY: -44,
    bendX: -78,
    rotation: 520,
    delay: 0,
  },
  {
    source: sceneAssets.bills[0],
    size: 64,
    startX: 144,
    startY: -92,
    bendX: 82,
    rotation: -28,
    delay: 110,
  },
  {
    source: sceneAssets.coins[1],
    size: 44,
    startX: 92,
    startY: -64,
    bendX: 48,
    rotation: -460,
    delay: 220,
  },
  {
    source: sceneAssets.bills[2],
    size: 58,
    startX: -92,
    startY: -122,
    bendX: -52,
    rotation: 34,
    delay: 320,
  },
  {
    source: sceneAssets.coins[3],
    size: 40,
    startX: 174,
    startY: -20,
    bendX: 94,
    rotation: 620,
    delay: 420,
  },
];

function jarIndex(progress: number) {
  if (progress <= 0) return 0;
  if (progress <= 0.14) return 1;
  if (progress <= 0.3) return 2;
  if (progress <= 0.46) return 3;
  if (progress <= 0.62) return 4;
  if (progress <= 0.8) return 5;
  return 6;
}

function MoneyDrop({
  eventId,
  phase,
  source,
  size,
  startX,
  startY,
  bendX,
  rotation,
  delay,
  onComplete,
}: (typeof moneyDrops)[number] & {
  eventId: number;
  phase: "front" | "inside";
  onComplete?: (eventId: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (reduceMotion) return;

    const animation = Animated.sequence([
      Animated.delay(620 + delay),
      Animated.timing(progress, {
        toValue: 1,
        duration: 1120,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onComplete?.(eventId);
    });
    return () => animation.stop();
  }, [delay, eventId, onComplete, progress, reduceMotion]);

  const isFront = phase === "front";

  return (
    <Animated.Image
      {...androidImageProps}
      source={source}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      style={[
        styles.drop,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          opacity: isFront
            ? progress.interpolate({
                inputRange: [0, 0.04, 0.73, 0.84, 1],
                outputRange: [0, 1, 1, 0, 0],
              })
            : progress.interpolate({
                inputRange: [0, 0.79, 0.84, 0.96, 1],
                outputRange: [0, 0, 0.9, 0.34, 0],
              }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 0.56, 0.84, 1],
                outputRange: [startX, bendX, 0, 0],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.84, 1],
                outputRange: [startY, 48, 142],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", `${rotation}deg`],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.78, 1],
                outputRange: [1, 0.38, isFront ? 0.2 : 0.08],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function MoneyLayer({
  eventId,
  phase,
  onComplete,
}: {
  eventId: number;
  phase: "front" | "inside";
  onComplete?: (eventId: number) => void;
}) {
  return (
    <View
      testID={`savings-money-${phase}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        phase === "front" ? styles.frontLayer : styles.insideLayer,
      ]}
    >
      {moneyDrops.map((drop, index) => (
        <MoneyDrop
          key={`${phase}-${index}`}
          {...drop}
          eventId={eventId}
          phase={phase}
          onComplete={index === moneyDrops.length - 1 ? onComplete : undefined}
        />
      ))}
    </View>
  );
}

export function SavingsScene({
  balance,
  goal,
  children,
}: {
  balance: number;
  goal: number;
  children?: ReactNode;
}) {
  const theme = useAppTheme();
  const isFocused = useIsFocused();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [sceneWidth, setSceneWidth] = useState(0);
  const accountId = useAppStore((state) => state.user.id);
  const rewardEventId = useAppStore((state) =>
    state.hydrated && state.cashBalanceReady && state.authMode === "authenticated"
      ? pendingSavingsCash(state.savingsCash, state.user.id)
      : null,
  );
  const acknowledgeCash = useAppStore((state) => state.acknowledgeSavingsCash);
  const [active, setActive] = useState(AppState.currentState === "active");
  const reduceMotion = useReducedMotion();
  const completeCashAnimation = useCallback((eventId: number) => {
    if (accountId) acknowledgeCash(accountId, eventId);
  }, [accountId, acknowledgeCash]);
  // Keep an unseen credit pending until Home is actually visible.
  const showMoney = isFocused && active && !reduceMotion && rewardEventId !== null;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isFocused && active && reduceMotion && rewardEventId !== null) {
      completeCashAnimation(rewardEventId);
    }
  }, [isFocused, active, reduceMotion, rewardEventId, completeCashAnimation]);
  const progress = Math.max(0, Math.min(1, balance / Math.max(goal, 1)));
  const stateIndex = jarIndex(progress);
  const layout = getSavingsSceneLayout(
    sceneWidth || Math.max(1, windowWidth - 40),
    windowHeight,
    windowWidth >= 1024,
  );
  const [jarOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    jarOpacity.stopAnimation();
    if (reduceMotion) {
      jarOpacity.setValue(1);
      return;
    }
    jarOpacity.setValue(0.25);
    const animation = Animated.timing(jarOpacity, {
      toValue: 1,
      duration: 420,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [jarOpacity, reduceMotion, stateIndex]);

  return (
    <View
      style={[styles.scene, { height: layout.height }]}
      onLayout={(event) => setSceneWidth(event.nativeEvent.layout.width)}
      accessibilityRole="summary"
      accessibilityLabel={`${formatMoney(balance)}, ${Math.round(progress * 100)}%`}
    >
      <View
        style={[
          styles.stage,
          {
            top: layout.stageTop,
            transform: [{ scale: layout.scale }],
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.halo, { backgroundColor: Platform.OS === "android" ? "transparent" : theme.orbOne }]}
        >
          {Platform.OS === "android" ? <AndroidSoftGlow color={theme.orbOne} diameter={310} blurRadius={44} /> : null}
        </View>
        <Image
          {...androidImageProps}
          source={sceneAssets.island}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          style={styles.island}
        />
        {showMoney ? <MoneyLayer eventId={rewardEventId} phase="inside" /> : null}
        <Animated.View
          style={[
            styles.jarGroup,
            {
              opacity: jarOpacity,
            },
          ]}
        >
          <Image
            {...androidImageProps}
            source={jarStateSources[stateIndex]}
            resizeMode="contain"
            accessibilityLabel={`${Math.round(progress * 100)}%`}
            accessibilityIgnoresInvertColors
            style={styles.jarShell}
          />
          <View style={styles.jarLabel} pointerEvents="none">
            <AppText style={styles.jarLabelText} numberOfLines={1}>
              {formatMoney(balance)}
            </AppText>
          </View>
        </Animated.View>
        {showMoney ? <MoneyLayer eventId={rewardEventId} phase="front" onComplete={completeCashAnimation} /> : null}
      </View>
      {children ? (
        <View pointerEvents="box-none" style={[styles.actionsOverlay, { top: layout.actionsTop }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionsOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 12,
  },
  scene: {
    width: "100%",
    alignItems: "center",
    position: "relative",
    overflow: "visible",
  },
  stage: {
    width: 372,
    height: 370,
    alignItems: "center",
    position: "relative",
  },
  halo: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 155,
    top: 26,
    opacity: 0.16,
    ...(Platform.OS === "web"
      ? ({ filter: "blur(44px)" } as unknown as ViewStyle)
      : {}),
  },
  island: {
    position: "absolute",
    width: 372,
    height: 272,
    top: 165,
    zIndex: 1,
  },
  jarGroup: {
    position: "absolute",
    width: 340,
    height: 340,
    top: -20,
    borderRadius: 170,
    zIndex: 4,
  },
  jarShell: {
    width: "100%",
    height: "100%",
  },
  jarLabel: {
    position: "absolute",
    left: 110,
    top: 176,
    width: 120,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  jarLabelText: {
    color: "#3E3425",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  insideLayer: {
    zIndex: 3,
  },
  frontLayer: {
    zIndex: 6,
  },
  drop: {
    position: "absolute",
    left: "50%",
    top: 0,
  },
});
