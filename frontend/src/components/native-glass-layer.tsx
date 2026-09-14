import { StyleSheet, View } from "react-native";

export function NativeGlassLayer({
  intensity,
  dark,
}: {
  intensity: number;
  dark: boolean;
}) {
  // A translucent overlay is substantially cheaper than one BlurView per card.
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: dark
            ? `rgba(20,29,45,${Math.min(0.88, 0.52 + intensity / 250)})`
            : `rgba(248,251,255,${Math.min(0.92, 0.58 + intensity / 250)})`,
        },
      ]}
    />
  );
}
