import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 13,
      }}
    >
      <AppText variant="heading">{title}</AppText>
      {action ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <AppText variant="caption" color={String(theme.primary)}>
            {action}
          </AppText>
          <Ionicons name="chevron-forward" size={15} color={String(theme.primary)} />
        </Pressable>
      ) : null}
    </View>
  );
}
