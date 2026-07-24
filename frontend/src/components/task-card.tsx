import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { AppText } from "@/components/app-text";
import { radii } from "@/constants/theme";
import type { TranslationKey } from "@/constants/translations";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import type { LogicTask } from "@/types";

const iconNames: Record<
  LogicTask["icon"],
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  play: "play",
  layers: "layers",
  sparkles: "sparkles",
  calendar: "calendar",
  people: "people",
};

function localize(
  value: string,
  t: (key: TranslationKey) => string,
) {
  return value.startsWith("task.") ? t(value as TranslationKey) : value;
}

export function TaskCard({
  task,
  onPress,
  loading,
  count = 0,
  compact,
}: {
  task: LogicTask;
  onPress: () => void;
  loading?: boolean;
  count?: number;
  compact?: boolean;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  const handlePress = () => {
    void Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
        compact && styles.cardCompact,
      ]}
    >
      <View
        style={[
          styles.icon,
          compact && styles.iconCompact,
          { backgroundColor: `${task.color}18` },
        ]}
      >
        <Ionicons
          name={iconNames[task.icon]}
          size={compact ? 20 : 23}
          color={task.color}
        />
      </View>
      <View style={styles.copy}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AppText variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
            {localize(task.titleKey, t)}
          </AppText>
          {count > 0 ? (
            <View
              style={[styles.count, { backgroundColor: theme.primarySoft }]}
            >
              <AppText variant="caption" color={String(theme.primary)}>
                ×{count}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="caption" muted numberOfLines={1}>
          {localize(task.descriptionKey, t)}
        </AppText>
      </View>
      <View style={styles.reward}>
        <AppText variant="label" color={task.color}>
          +{task.rewardUnits}
        </AppText>
        <AppText variant="caption" color={task.color}>
          LC
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("task.perform")}: ${localize(task.titleKey, t)}`}
        disabled={loading || task.available === false}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: theme.primary,
            opacity:
              pressed
                ? 0.8
                : loading || task.available === false
                  ? 0.45
                  : 1,
          },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : task.available === false ? (
          <Ionicons name="time-outline" color="#FFFFFF" size={18} />
        ) : (
          <Ionicons name="arrow-forward" color="#FFFFFF" size={18} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 84,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    shadowOpacity: Platform.OS === "web" ? 0.055 : 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardCompact: {
    minHeight: 76,
    paddingVertical: 10,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCompact: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  reward: {
    alignItems: "flex-end",
  },
  count: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  action: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
