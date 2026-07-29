import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { NativeGlassLayer } from "@/components/native-glass-layer";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

type GlassSurfaceProps = PropsWithChildren<
  Omit<ViewProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  variant?: "soft" | "regular" | "strong";
  }
>;

export function GlassSurface({
  children,
  style,
  intensity = 62,
  variant = "regular",
  ...viewProps
}: GlassSurfaceProps) {
  const theme = useAppTheme();
  const flattenedStyle = StyleSheet.flatten(style) ?? {};
  const defaultRadius =
    typeof flattenedStyle.borderRadius === "number"
      ? flattenedStyle.borderRadius
      : radii.lg;
  const corners = {
    borderTopLeftRadius:
      typeof flattenedStyle.borderTopLeftRadius === "number"
        ? flattenedStyle.borderTopLeftRadius
        : defaultRadius,
    borderTopRightRadius:
      typeof flattenedStyle.borderTopRightRadius === "number"
        ? flattenedStyle.borderTopRightRadius
        : defaultRadius,
    borderBottomRightRadius:
      typeof flattenedStyle.borderBottomRightRadius === "number"
        ? flattenedStyle.borderBottomRightRadius
        : defaultRadius,
    borderBottomLeftRadius:
      typeof flattenedStyle.borderBottomLeftRadius === "number"
        ? flattenedStyle.borderBottomLeftRadius
        : defaultRadius,
  };
  const fill =
    variant === "soft"
      ? theme.glassFill
      : variant === "strong"
        ? theme.glassFillStrong
        : theme.glassFill;

  return (
    <View
      {...viewProps}
      style={[
        styles.surface,
        {
          backgroundColor: fill,
          borderColor: theme.glassBorder,
          shadowColor: theme.glassShadow,
        },
        Platform.OS === "web"
          ? ({
              backdropFilter: `blur(${Math.max(12, intensity / 2)}px) saturate(165%)`,
              WebkitBackdropFilter: `blur(${Math.max(12, intensity / 2)}px) saturate(165%)`,
            } as unknown as ViewStyle)
          : null,
        style,
        corners,
      ]}
    >
      {Platform.OS === "web" ? null : (
        <NativeGlassLayer intensity={intensity} dark={theme.mode === "dark"} />
      )}
      <LinearGradient
        pointerEvents="none"
        colors={[
          String(theme.glassHighlight),
          "rgba(255,255,255,0.08)",
          "rgba(76,164,255,0.04)",
        ]}
        locations={[0, 0.42, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, corners]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.rim,
          {
            borderTopColor: theme.glassHighlight,
            borderLeftColor: theme.glassHighlight,
            borderRightColor: "rgba(255,255,255,0.18)",
            borderBottomColor: "rgba(83,139,190,0.12)",
          },
          corners,
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: "relative",
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: Platform.OS === "web" ? 0.15 : 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
  rim: {
    position: "absolute",
    inset: 0,
    borderWidth: 1,
  },
});
