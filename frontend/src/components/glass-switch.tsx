import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { GlassSurface } from "@/components/glass-surface";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

const TRACK_WIDTH = 60;
const TRACK_HEIGHT = 36;
const THUMB_SIZE = 28;
const TRACK_INSET = 4;
const ACTIVE_OFFSET = TRACK_WIDTH - THUMB_SIZE - TRACK_INSET * 2;

export function GlassSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(value ? 1 : 0, { duration: 0 })
      : withSpring(value ? 1 : 0, {
          damping: 18,
          stiffness: 230,
          mass: 0.72,
        });
  }, [progress, reduceMotion, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * ACTIVE_OFFSET }],
  }));

  const handlePress = () => {
    if (disabled) return;
    void Haptics.selectionAsync().catch(() => {});
    onValueChange(!value);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.hitTarget,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <GlassSurface
        pointerEvents="none"
        intensity={76}
        variant="strong"
        style={[
          styles.track,
          {
            backgroundColor: value
              ? `${String(theme.primary)}38`
              : theme.glassFill,
            borderColor: value
              ? `${String(theme.primary)}72`
              : theme.glassBorder,
            shadowColor: value ? theme.primary : theme.glassShadow,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.trackGlow,
            {
              backgroundColor: value
                ? `${String(theme.primary)}24`
                : "transparent",
            },
          ]}
        />
        <Animated.View style={[styles.thumbPosition, thumbStyle]}>
          <GlassSurface
            pointerEvents="none"
            intensity={88}
            variant="strong"
            style={[
              styles.thumb,
              {
                backgroundColor: value
                  ? "rgba(255,255,255,0.88)"
                  : theme.glassFillStrong,
                borderColor: value
                  ? "rgba(255,255,255,0.96)"
                  : theme.glassBorder,
                shadowColor: value ? theme.primary : theme.glassShadow,
              },
            ]}
          >
            <View
              style={[
                styles.thumbCore,
                {
                  backgroundColor: value
                    ? theme.primary
                    : theme.textMuted,
                },
              ]}
            />
          </GlassSurface>
        </Animated.View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitTarget: {
    width: 68,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    borderWidth: 1,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  trackGlow: {
    position: "absolute",
    inset: 0,
    borderRadius: radii.pill,
  },
  thumbPosition: {
    position: "absolute",
    top: TRACK_INSET,
    left: TRACK_INSET,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.34,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  thumbCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
