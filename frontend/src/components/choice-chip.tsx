import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
} from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: Boolean(selected) }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        borderRadius: 999,
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <GlassSurface
        intensity={44}
        variant={selected ? "strong" : "soft"}
        style={{
          minHeight: 44,
          borderRadius: 999,
          paddingHorizontal: 14,
          borderColor: selected ? theme.primary : theme.glassBorder,
          backgroundColor: selected ? theme.primarySoft : theme.glassFill,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {selected ? (
          <Animated.View
            entering={FadeIn.duration(170).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
          >
            <View
              style={{
                width: 17,
                height: 17,
                borderRadius: 9,
                backgroundColor: theme.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          </Animated.View>
        ) : null}
        <AppText
          variant="caption"
          color={selected ? String(theme.primary) : undefined}
        >
          {label}
        </AppText>
      </GlassSurface>
    </Pressable>
  );
}
