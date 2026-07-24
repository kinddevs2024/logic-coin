import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { ComponentProps, PropsWithChildren } from "react";

import { AppText } from "@/components/app-text";
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
        !isPrimary && { backgroundColor: background },
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
          colors={[String(theme.primary), String(theme.primaryDark)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {inner}
        </LinearGradient>
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
        styles.iconButton,
        {
          backgroundColor: filled ? theme.primary : theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}
    >
      <Ionicons
        name={name}
        size={21}
        color={filled ? "#FFFFFF" : String(theme.text)}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: 52,
    borderRadius: radii.md,
  },
  gradient: {
    flex: 1,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  inner: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  compact: {
    minHeight: 42,
    paddingHorizontal: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: Platform.OS === "web" ? 0.08 : 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});
