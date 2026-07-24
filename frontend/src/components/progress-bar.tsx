import { View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

export function ProgressBar({
  value,
  height = 8,
  color,
  accessibilityLabel = "Progress",
}: {
  value: number;
  height?: number;
  color?: string;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const progress = Math.min(1, Math.max(0, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.primarySoft,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: color ?? theme.primary,
        }}
      />
    </View>
  );
}
