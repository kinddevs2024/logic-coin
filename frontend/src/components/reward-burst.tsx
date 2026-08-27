import { useEffect, useState } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";
import { formatMoney } from "@/lib/format";

export function RewardBurst() {
  const reward = useAppStore((state) => state.latestReward);
  const clear = useAppStore((state) => state.clearLatestReward);
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!reward) return;
    progress.setValue(0);
    const animation = Animated.sequence([
      Animated.spring(progress, {
        toValue: 1,
        damping: 9,
        stiffness: 150,
        mass: 0.7,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.delay(850),
      Animated.timing(progress, {
        toValue: 2,
        duration: 300,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) clear();
    });
    return () => animation.stop();
  }, [clear, progress, reward]);

  if (!reward) return null;

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View
        style={[
          styles.burst,
          {
            backgroundColor: theme.surfaceRaised,
            borderColor: theme.primarySoft,
            shadowColor: theme.primary,
            opacity: progress.interpolate({
              inputRange: [0, 0.25, 1, 2],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [30, 0, -34],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.75, 1, 2],
                  outputRange: [0.65, 1.08, 1, 0.92],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.coin, { backgroundColor: theme.primary }]}>
          <Ionicons name="sparkles" color="#FFFFFF" size={20} />
        </View>
        <View>
          <AppText variant="caption" muted>
            {t("task.added")}
          </AppText>
          <AppText variant="heading" color={String(theme.primary)}>
            +{formatMoney(reward.amount)}
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 116,
  },
  burst: {
    minWidth: 196,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  coin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
