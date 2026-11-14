import { useUiCopy } from "@/components/localized-native";

import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

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
  const { copyContent } = useUiCopy();
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
      <AppText variant="heading">{copyContent(title)}</AppText>
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
            {copyContent(action)}
          </AppText>
          <Ionicons name="chevron-forward" size={15} color={String(theme.primary)} />
        </Pressable>
      ) : null}
    </View>
  );
}
