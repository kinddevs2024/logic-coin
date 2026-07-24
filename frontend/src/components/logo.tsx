import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { View } from "react-native";

import { AppText } from "@/components/app-text";

export function LogoMark({ size = 52 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="lc-logo" x1="8" y1="6" x2="55" y2="59">
          <Stop offset="0" stopColor="#42B4FF" />
          <Stop offset="0.52" stopColor="#0866FF" />
          <Stop offset="1" stopColor="#5138EE" />
        </LinearGradient>
      </Defs>
      <Circle cx="32" cy="32" r="29" fill="url(#lc-logo)" />
      <Circle
        cx="32"
        cy="32"
        r="23"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.28}
        strokeWidth="1.4"
      />
      <Path
        d="M23 18v22.5c0 3.1 1.9 5.5 5.8 5.5H42"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6"
      />
      <Path
        d="M34.5 21H43v8.5M43 21 32.5 31.5"
        fill="none"
        stroke="#BCE1FF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </Svg>
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
      <LogoMark size={compact ? 38 : 48} />
      <View>
        <AppText
          variant={compact ? "heading" : "title"}
          color={light ? "#FFFFFF" : undefined}
          style={{ lineHeight: compact ? 23 : 30 }}
        >
          Logic Coin
        </AppText>
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
