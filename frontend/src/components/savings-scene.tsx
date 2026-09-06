import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import {
  Animated,
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
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

const islandSource = require("../../assets/scene/island.png");
const jarStateSources: ImageSourcePropType[] = [
  require("../../assets/scene/1-Photoroom.png"),
  require("../../assets/scene/2-Photoroom.png"),
  require("../../assets/scene/3-Photoroom.png"),
  require("../../assets/scene/4-Photoroom.png"),
  require("../../assets/scene/5-Photoroom.png"),
  require("../../assets/scene/6-Photoroom.png"),
  require("../../assets/scene/7-Photoroom.png"),
];

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
    source: require("../../assets/scene/coin-angle.png"),
    size: 48,
    startX: -150,
    startY: -44,
    bendX: -78,
    rotation: 520,
    delay: 0,
  },
  {
    source: require("../../assets/scene/bill-1.png"),
    size: 64,
    startX: 144,
    startY: -92,
    bendX: 82,
    rotation: -28,
    delay: 110,
  },
  {
    source: require("../../assets/scene/coin-gold-a.png"),
    size: 44,
    startX: 92,
    startY: -64,
    bendX: 48,
    rotation: -460,
    delay: 220,
  },
  {
    source: require("../../assets/scene/bill-10.png"),
    size: 58,
    startX: -92,
    startY: -122,
    bendX: -52,
    rotation: 34,
    delay: 320,
  },
  {
    source: require("../../assets/scene/coin-silver.png"),
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
}: (typeof moneyDrops)[number] & {
  eventId: number;
  phase: "front" | "inside";
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
    animation.start();
    return () => animation.stop();
  }, [delay, eventId, progress, reduceMotion]);

  const isFront = phase === "front";

  return (
    <Animated.Image
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
}: {
  eventId: number;
  phase: "front" | "inside";
}) {
  return (
    <View
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
        />
      ))}
    </View>
  );
}

export function SavingsScene({
  balance,
  goal,
}: {
  balance: number;
  goal: number;
}) {
  const theme = useAppTheme();
  const isFocused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const rewardEventId = useAppStore((state) => state.rewardEventId);
  const reduceMotion = useReducedMotion();
  const progress = Math.max(0, Math.min(1, balance / Math.max(goal, 1)));
  const stateIndex = jarIndex(progress);
  const stageScale = Math.min(
    1,
    Math.max(0.62, (windowWidth - 32) / 372),
  );
  const [jarOpacity] = useState(() => new Animated.Value(1));
  const [drift] = useState(() => new Animated.Value(0));

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

  useEffect(() => {
    if (reduceMotion || !isFocused) {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 3200,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 3200,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift, isFocused, reduceMotion]);

  return (
    <View
      style={[styles.scene, { height: 370 * stageScale }]}
      accessibilityRole="summary"
      accessibilityLabel={`${formatMoney(balance)}, ${Math.round(progress * 100)}%`}
    >
      <View
        style={[
          styles.stage,
          {
            top: (370 * stageScale - 370) / 2,
            transform: [{ scale: stageScale }],
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.halo, { backgroundColor: theme.orbOne }]}
        />
        <Image
          source={islandSource}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          style={styles.island}
        />
        <View style={styles.contactShadow} />
        <MoneyLayer eventId={rewardEventId} phase="inside" />
        <Animated.View
          style={[
            styles.jarGroup,
            {
              opacity: jarOpacity,
              transform: [
                {
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, -4],
                  }),
                },
                {
                  rotate: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-0.35deg", "0.35deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
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
        <MoneyLayer eventId={rewardEventId} phase="front" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  contactShadow: {
    position: "absolute",
    width: 154,
    height: 30,
    borderRadius: 77,
    top: 294,
    backgroundColor: "rgba(18,38,28,0.24)",
    zIndex: 2,
    ...(Platform.OS === "web"
      ? ({ filter: "blur(12px)" } as unknown as ViewStyle)
      : {}),
  },
  jarGroup: {
    position: "absolute",
    width: 340,
    height: 340,
    top: -22,
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
