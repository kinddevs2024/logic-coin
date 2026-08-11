import { Ionicons } from "@expo/vector-icons";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { AppText } from "@/components/app-text";

export const PIXEL_GAME_COLORS = {
  background: "#FFB38B",
  backgroundDeep: "#F79A74",
  arena: "#E87559",
  arenaDark: "#B73328",
  arenaShadow: "#C84E3C",
  frame: "#FFF9F1",
  frameWarm: "#FFC7A8",
  panel: "#FFF1E6",
  panelStrong: "#FFE1CF",
  ink: "#38394A",
  muted: "#8A5C52",
  yellow: "#FFE500",
  yellowDark: "#E9BA00",
  danger: "#B72F27",
  success: "#397A63",
} as const;

export const PIXEL_ARENA_CHROME = 28;

export function PixelArena({
  children,
  style,
  contentStyle,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>) {
  return (
    <View style={[styles.arenaOuter, style]}>
      <View style={[styles.arenaMiddle, contentStyle]}>{children}</View>
    </View>
  );
}

export function PixelPanel({
  children,
  style,
  selected,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
}>) {
  return (
    <View style={[styles.panel, selected && styles.panelSelected, style]}>{children}</View>
  );
}

export function PixelStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <PixelPanel style={styles.stat}>
      <AppText style={styles.statLabel}>{label.toUpperCase()}</AppText>
      <AppText style={styles.statValue}>{value}</AppText>
    </PixelPanel>
  );
}

export function PixelIconButton({
  icon,
  label,
  onPress,
  disabled,
  size = 50,
  active,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size },
        active && styles.iconButtonActive,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconButtonInner}>
        <Ionicons
          name={icon}
          size={Math.round(size * 0.46)}
          color={PIXEL_GAME_COLORS.ink}
        />
      </View>
    </Pressable>
  );
}

export function PixelActionButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.disabled,
        pressed && styles.actionPressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={PIXEL_GAME_COLORS.ink} /> : null}
      <AppText style={styles.actionLabel}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  arenaOuter: {
    padding: 6,
    borderRadius: 10,
    borderWidth: 4,
    borderColor: PIXEL_GAME_COLORS.frame,
    backgroundColor: PIXEL_GAME_COLORS.frameWarm,
    shadowColor: PIXEL_GAME_COLORS.arenaShadow,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.72,
    shadowRadius: 0,
    elevation: 8,
  },
  arenaMiddle: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 4,
    borderWidth: 4,
    borderColor: PIXEL_GAME_COLORS.arenaDark,
    backgroundColor: PIXEL_GAME_COLORS.arena,
  },
  panel: {
    borderRadius: 8,
    borderWidth: 3,
    borderColor: PIXEL_GAME_COLORS.frame,
    backgroundColor: PIXEL_GAME_COLORS.panel,
    shadowColor: PIXEL_GAME_COLORS.arenaShadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.55,
    shadowRadius: 0,
    elevation: 4,
  },
  panelSelected: {
    borderColor: PIXEL_GAME_COLORS.yellow,
    backgroundColor: PIXEL_GAME_COLORS.panelStrong,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingHorizontal: 6,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  statLabel: {
    color: PIXEL_GAME_COLORS.muted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  statValue: {
    color: PIXEL_GAME_COLORS.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
  },
  iconButton: {
    padding: 3,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: PIXEL_GAME_COLORS.frame,
    backgroundColor: PIXEL_GAME_COLORS.frame,
    shadowColor: PIXEL_GAME_COLORS.ink,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.72,
    shadowRadius: 0,
    elevation: 5,
  },
  iconButtonActive: {
    backgroundColor: PIXEL_GAME_COLORS.yellow,
    borderColor: PIXEL_GAME_COLORS.yellow,
  },
  iconButtonInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    borderWidth: 3,
    borderColor: PIXEL_GAME_COLORS.ink,
    backgroundColor: PIXEL_GAME_COLORS.panel,
  },
  pressed: {
    transform: [{ translateY: 3 }],
    shadowOffset: { width: 0, height: 2 },
  },
  actionButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: PIXEL_GAME_COLORS.frame,
    backgroundColor: PIXEL_GAME_COLORS.yellow,
    shadowColor: PIXEL_GAME_COLORS.yellowDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  actionPressed: {
    transform: [{ translateY: 3 }],
    shadowOffset: { width: 0, height: 2 },
  },
  actionLabel: {
    color: PIXEL_GAME_COLORS.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  disabled: { opacity: 0.36 },
});
