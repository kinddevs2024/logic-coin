import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/app-text";
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
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 40,
          borderRadius: 999,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? theme.primarySoft : theme.surface,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {selected ? (
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
      ) : null}
      <AppText
        variant="caption"
        color={selected ? String(theme.primary) : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
