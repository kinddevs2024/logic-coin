import { Image, View } from "react-native";

export function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
    <Image
      accessibilityIgnoresInvertColors
      source={require("../../assets/brand/logo-mark.png")}
      resizeMode="contain"
      style={{ width: size * 1.7, height: size * 1.7 }}
    />
    </View>
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
