import { Image, View } from "react-native";

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
    </View>
  );
}
