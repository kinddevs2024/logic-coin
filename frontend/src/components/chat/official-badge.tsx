import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
export function OfficialBadge() {
  const theme = useAppTheme();
  const language = useAppStore((s) => s.language);
  return (
    <View
      accessible
      accessibilityLabel={
        language === "uz"
          ? "Rasmiy Logic Coin"
          : language === "en"
            ? "Official Logic Coin"
            : "Официальный Logic Coin"
      }
      style={{
        backgroundColor: theme.primary,
        borderRadius: 10,
        padding: 3,
        alignSelf: "center",
      }}
    >
      <Ionicons name="star" size={11} color={String(theme.onPrimary)} />
    </View>
  );
}
