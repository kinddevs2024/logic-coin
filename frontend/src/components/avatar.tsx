import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  size = 44,
}: {
  name?: string;
  size?: number;
}) {
  return (
    <LinearGradient
      colors={["#50BAFF", "#0866FF", "#5945E8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        padding: Math.max(2, size * 0.045),
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: size / 2,
          backgroundColor: "rgba(255,255,255,0.16)",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
        }}
      >
        <AppText
          variant={size > 64 ? "heading" : "label"}
          color="#FFFFFF"
          style={{ fontSize: size * 0.32 }}
        >
          {initials(name)}
        </AppText>
      </View>
    </LinearGradient>
  );
}
