import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ComponentProps, PropsWithChildren } from "react";

import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { radii } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

type AppButtonProps = PropsWithChildren<{
  onPress?: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  glow?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}>;

export function AppButton({
  children,
  onPress,
  icon,
  variant = "primary",
  loading,
  disabled,
  glow,
  compact,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const theme = useAppTheme();
  const isPrimary = variant === "primary";
  const foreground =
    isPrimary || variant === "danger" ? "#FFFFFF" : String(theme.text);
  const background =
    variant === "secondary"
      ? String(theme.surfaceMuted)
      : variant === "ghost"
        ? "transparent"
        : variant === "danger"
          ? String(theme.danger)
          : String(theme.primary);

  const handlePress = () => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const inner = (
    <View
      style={[
        styles.inner,
        compact && styles.compact,
        !isPrimary && variant !== "secondary" && { backgroundColor: background },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={foreground} /> : null}
          <AppText variant="label" color={foreground}>
            {children}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.pressable,
        glow && {
          shadowColor: theme.primary,
          shadowOpacity: 0.44,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 9 },
          elevation: 10,
        },
        (disabled || loading) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.975 }], opacity: 0.92 },
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[
            `${String(theme.primary)}E8`,
            String(theme.primaryDark),
            "#0648B8",
          ]}
          locations={[0, 0.66, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0.52)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
          {inner}
        </LinearGradient>
      ) : variant === "secondary" ? (
        <GlassSurface
          intensity={58}
          variant="strong"
          style={styles.secondaryGlass}
        >
          {inner}
        </GlassSurface>
      ) : (
        inner
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  filled,
}: {
  name: IconName;
  onPress?: () => void;
  label: string;
  filled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconPressable,
        pressed && { transform: [{ scale: 0.94 }] },
      ]}
    >
      <GlassSurface
        intensity={72}
        variant="strong"
        style={[
          styles.iconButton,
          filled && {
            backgroundColor: theme.primary,
            borderColor: "rgba(255,255,255,0.42)",
          },
        ]}
      >
        <Ionicons
          name={name}
          size={21}
          color={filled ? "#FFFFFF" : String(theme.text)}
        />
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: 52,
    borderRadius: radii.pill,
  },
  gradient: {
    flex: 1,
    borderRadius: radii.pill,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)",
  },
  inner: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  compact: {
    minHeight: 42,
    paddingHorizontal: 14,
  },
  secondaryGlass: {
    flex: 1,
    borderRadius: radii.pill,
  },
  iconPressable: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
