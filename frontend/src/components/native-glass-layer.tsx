import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";

export function NativeGlassLayer({
  intensity,
  dark,
}: {
  intensity: number;
  dark: boolean;
}) {
  // Android live backdrop captures are repeated for every visible surface.
  // Parent surfaces already provide the tint, gradient and rim; use those
  // lightweight layers instead of continuously re-blurring the scene.
  if (Platform.OS === "android") return null;

  return (
    <BlurView
      pointerEvents="none"
      intensity={intensity}
      tint={dark ? "dark" : "systemUltraThinMaterialLight"}
      style={StyleSheet.absoluteFill}
    />
  );
}
