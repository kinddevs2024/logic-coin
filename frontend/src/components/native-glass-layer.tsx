import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";

import { useGlassBlurTarget } from "@/components/glass-blur-target";

export function NativeGlassLayer({
  intensity,
  dark,
}: {
  intensity: number;
  dark: boolean;
}) {
  const blurTarget = useGlassBlurTarget();

  return (
    <BlurView
      pointerEvents="none"
      intensity={intensity}
      tint={dark ? "dark" : "systemUltraThinMaterialLight"}
      {...(Platform.OS === "android" && blurTarget
        ? {
            blurMethod: "dimezisBlurViewSdk31Plus" as const,
            blurTarget,
          }
        : {})}
      style={StyleSheet.absoluteFill}
    />
  );
}
