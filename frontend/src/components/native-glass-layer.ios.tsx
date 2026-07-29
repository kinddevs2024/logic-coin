import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";

export function NativeGlassLayer({
  intensity,
  dark,
}: {
  intensity: number;
  dark: boolean;
}) {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(
      setReduceTransparency,
    );
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => subscription.remove();
  }, []);

  if (reduceTransparency) {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: dark
              ? "rgba(12,28,52,0.96)"
              : "rgba(245,251,255,0.96)",
          },
        ]}
      />
    );
  }

  const glassAvailable =
    isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

  if (glassAvailable) {
    return (
      <GlassView
        pointerEvents="none"
        colorScheme={dark ? "dark" : "light"}
        glassEffectStyle="clear"
        isInteractive={false}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return (
    <BlurView
      pointerEvents="none"
      intensity={intensity}
      tint={dark ? "dark" : "systemUltraThinMaterialLight"}
      style={StyleSheet.absoluteFill}
    />
  );
}
