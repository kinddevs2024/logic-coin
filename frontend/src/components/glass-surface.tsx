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
  const dark = theme.mode === "dark";
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
          // Without native blur, Android must not composite a translucent
          // elevated background independently behind each flattened child.
          // An opaque tinted base keeps the whole card one continuous surface.
          backgroundColor: Platform.OS === "android"
            ? variant === "strong" ? theme.surfaceRaised : theme.surface
            : fill,
          borderColor: theme.glassBorder,
          shadowColor: theme.glassShadow,
          ...(dark ? { shadowOpacity: 0.18, elevation: 3 } : {}),
        },
        Platform.OS === "web"
          ? ({
              backdropFilter: `blur(${Math.max(12, intensity / 2)}px) saturate(138%)`,
              WebkitBackdropFilter: `blur(${Math.max(12, intensity / 2)}px) saturate(138%)`,
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
          dark ? "rgba(184,204,188,0.01)" : "rgba(255,255,238,0.03)",
          dark ? "rgba(23,102,72,0.025)" : "rgba(120,221,176,0.015)",
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
            borderRightColor: dark ? "rgba(162,212,180,0.06)" : "rgba(255,255,238,0.18)",
            borderBottomColor: dark ? "rgba(162,212,180,0.04)" : "rgba(50,111,80,0.12)",
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
    shadowOpacity: Platform.OS === "web" ? 0.08 : 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  rim: {
    position: "absolute",
    inset: 0,
    borderWidth: 1,
  },
});
