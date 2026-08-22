import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { gameCoverFor } from "@/constants/game-covers";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { ChallengeGameState, GameCatalogItem } from "@/types";

function iconName(icon: string): ComponentProps<typeof Ionicons>["name"] {
  return icon as ComponentProps<typeof Ionicons>["name"];
}

export function ChallengeCard({
  game,
  state,
  onPress,
  loading,
  compact,
  index = 0,
}: {
  game: GameCatalogItem;
  state?: ChallengeGameState;
  onPress: () => void;
  loading?: boolean;
  compact?: boolean;
  index?: number;
}) {
  const theme = useAppTheme();
  const completed = state?.status === "completed";
  const cover = gameCoverFor(game.key);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(420)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${completed ? "Пройдено" : "Играть"}: ${game.title}`}
        disabled={loading || completed}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <GlassSurface
          intensity={compact ? 52 : 68}
          variant="strong"
          style={[
            styles.card,
            compact && styles.cardCompact,
            { borderColor: completed ? `${String(theme.success)}55` : theme.border },
          ]}
        >
          <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: `${game.color}18`, borderColor: `${game.color}32` }]}>
            {cover ? <Image source={cover} resizeMode="cover" style={styles.cover} accessibilityIgnoresInvertColors /> : <Ionicons name={iconName(game.icon)} size={compact ? 21 : 25} color={game.color} />}
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <AppText variant="label" numberOfLines={1} style={styles.title}>{game.title}</AppText>
              {completed ? (
                <View style={[styles.doneBadge, { backgroundColor: `${String(theme.success)}14` }]}>
                  <Ionicons name="checkmark-circle" size={13} color={String(theme.success)} />
                  <AppText style={[styles.doneText, { color: String(theme.success) }]}>готово</AppText>
                </View>
              ) : null}
            </View>
            {compact ? null : <AppText variant="caption" muted numberOfLines={1}>{game.description}</AppText>}
          </View>
          {completed ? (
            <View style={styles.reward}>
              <Ionicons name="diamond" size={14} color="#F5B800" />
              <AppText style={[styles.rewardText, { color: String(theme.text) }]}>+{state?.coinsAwarded ?? 0}</AppText>
            </View>
          ) : null}
          <View style={[styles.action, { backgroundColor: completed ? `${String(theme.success)}18` : game.color }]}>
            {loading ? (
              <ActivityIndicator color={completed ? String(theme.success) : "#FFFFFF"} size="small" />
            ) : (
              <Ionicons name={completed ? "checkmark" : "arrow-forward"} color={completed ? String(theme.success) : "#FFFFFF"} size={18} />
            )}
          </View>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 92, borderRadius: radii.xl, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden" },
  cardCompact: { minHeight: 72, paddingVertical: 10, paddingHorizontal: 11 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.988 }] },
  icon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  iconCompact: { width: 43, height: 43, borderRadius: 22 },
  cover: { width: "100%", height: "100%", borderRadius: 26 },
  copy: { flex: 1, gap: 3, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7, minWidth: 0 },
  title: { flexShrink: 1 },
  doneBadge: { borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3 },
  doneText: { fontSize: 9, lineHeight: 11, fontWeight: "900", textTransform: "uppercase" },
  reward: { flexDirection: "row", alignItems: "center", gap: 3 },
  rewardText: { fontSize: 13, lineHeight: 16, fontWeight: "900" },
  action: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
