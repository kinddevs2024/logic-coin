import { Image, View } from "react-native";

import { AppText } from "@/components/app-text";

export function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={require("../../assets/brand/logo-mark.png")}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

export function LogicCoinLogo({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <LogoMark size={compact ? 88 : 98} />
      <View>
        {!compact ? (
          <AppText
            variant="caption"
            color={light ? "rgba(255,255,255,0.7)" : undefined}
            muted={!light}
            style={{ letterSpacing: 1.8, textTransform: "uppercase" }}
          >
            save · grow · enjoy
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
