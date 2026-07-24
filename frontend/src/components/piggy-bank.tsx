import { useEffect, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

import { useAppTheme } from "@/hooks/use-app-theme";
import type { PiggyKind } from "@/types";

function PigGraphic({ kind, size }: { kind: PiggyKind; size: number }) {
  const theme = useAppTheme();
  const primary = String(theme.primary);
  const primaryDark = String(theme.primaryDark);

  return (
    <Svg width={size} height={size} viewBox="0 0 240 220">
      <Defs>
        <SvgGradient id="bank-blue" x1="28" y1="16" x2="203" y2="207">
          <Stop offset="0" stopColor="#A9E1FF" />
          <Stop offset="0.38" stopColor={primary} />
          <Stop offset="1" stopColor={primaryDark} />
        </SvgGradient>
        <SvgGradient id="bank-glass" x1="45" y1="25" x2="188" y2="205">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.92} />
          <Stop offset="0.55" stopColor="#B7DDFF" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#6DB3FF" stopOpacity={0.82} />
        </SvgGradient>
        <SvgGradient id="bank-gold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFEAA0" />
          <Stop offset="0.6" stopColor="#FFBE3F" />
          <Stop offset="1" stopColor="#F79009" />
        </SvgGradient>
      </Defs>

      <Ellipse
        cx="120"
        cy="198"
        rx="80"
        ry="12"
        fill={primary}
        opacity={0.13}
      />

      {kind === "pig" ? (
        <G>
          <Path
            d="M65 82 52 56c-2-5 4-9 8-6l25 18M164 72l22-20c4-4 10 1 7 6l-11 27"
            fill="url(#bank-blue)"
            stroke={primaryDark}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <Path
            d="M51 124c0-38 32-65 76-65 49 0 82 28 82 69 0 28-15 47-39 56l-4 20h-27l-4-14H94l-5 14H63l-3-23c-17-12-25-31-25-52 0-12 6-22 16-22Z"
            fill="url(#bank-blue)"
            stroke={primaryDark}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <Ellipse cx="189" cy="132" rx="30" ry="24" fill="#B9E4FF" />
          <Circle cx="180" cy="132" r="4" fill={primaryDark} />
          <Circle cx="197" cy="132" r="4" fill={primaryDark} />
          <Circle cx="154" cy="105" r="6" fill="#FFFFFF" />
          <Circle cx="156" cy="106" r="2.5" fill="#173C71" />
          <Rect x="98" y="66" width="47" height="7" rx="3.5" fill="#0B4FB5" />
          <Path
            d="M48 108c-14-2-18-18-8-24 8-4 15 3 10 10"
            fill="none"
            stroke={primaryDark}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Path
            d="M83 83c15-12 43-17 66-10"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.48}
            strokeWidth="7"
            strokeLinecap="round"
          />
        </G>
      ) : null}

      {kind === "jar" ? (
        <G>
          <Path
            d="M75 50h90l-4 24c20 17 28 40 26 70l-4 36c-1 13-11 22-24 22H81c-13 0-23-9-24-22l-4-36c-3-30 6-53 26-70Z"
            fill="url(#bank-glass)"
            stroke={primaryDark}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <Rect x="69" y="42" width="102" height="25" rx="10" fill="url(#bank-blue)" />
          <Rect x="79" y="48" width="82" height="5" rx="2.5" fill="#FFFFFF" opacity={0.38} />
          {[0, 1, 2, 3].map((item) => (
            <G key={item}>
              <Ellipse
                cx={88 + item * 22}
                cy={174 - (item % 2) * 9}
                rx="17"
                ry="7"
                fill="url(#bank-gold)"
                stroke="#E89517"
                strokeWidth="2"
              />
              <Path
                d={`M${88 + item * 22} ${169 - (item % 2) * 9}v10`}
                stroke="#FFF3C4"
                strokeWidth="2"
              />
            </G>
          ))}
          <Path
            d="M77 91c-8 21-9 52-4 79"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="8"
            strokeLinecap="round"
            opacity={0.72}
          />
        </G>
      ) : null}

      {kind === "safe" ? (
        <G>
          <Rect
            x="43"
            y="40"
            width="154"
            height="158"
            rx="28"
            fill="url(#bank-blue)"
            stroke={primaryDark}
            strokeWidth="5"
          />
          <Rect
            x="59"
            y="56"
            width="122"
            height="126"
            rx="20"
            fill="#D8ECFF"
            stroke="#0E56B9"
            strokeWidth="4"
          />
          <Circle cx="121" cy="119" r="35" fill="#FFFFFF" stroke={primary} strokeWidth="6" />
          <Circle cx="121" cy="119" r="12" fill="url(#bank-blue)" />
          {[0, 1, 2, 3].map((item) => {
            const points = [
              [121, 91, 121, 101],
              [149, 119, 139, 119],
              [121, 147, 121, 137],
              [93, 119, 103, 119],
            ][item];
            return (
              <Path
                key={item}
                d={`M${points[0]} ${points[1]}L${points[2]} ${points[3]}`}
                stroke={primaryDark}
                strokeWidth="5"
                strokeLinecap="round"
              />
            );
          })}
          <Rect x="161" y="94" width="9" height="52" rx="4.5" fill={primaryDark} />
          <Path d="M68 68h54" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity={0.48} />
          <Rect x="77" y="190" width="27" height="14" rx="5" fill="#063E8E" />
          <Rect x="137" y="190" width="27" height="14" rx="5" fill="#063E8E" />
        </G>
      ) : null}

      {kind === "car" ? (
        <G>
          <Path
            d="M39 129c2-18 15-30 34-34l18-32c6-10 15-15 28-15h27c13 0 24 6 31 17l20 31c16 4 25 16 25 33v31H39Z"
            fill="url(#bank-blue)"
            stroke={primaryDark}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <Path
            d="m93 94 14-25c3-5 7-7 13-7h23c6 0 10 3 13 8l15 24Z"
            fill="#D9F1FF"
            stroke="#0B54AE"
            strokeWidth="3"
          />
          <Path d="M132 63v31" stroke="#88C9F7" strokeWidth="3" />
          <Circle cx="78" cy="161" r="25" fill="#173250" />
          <Circle cx="78" cy="161" r="12" fill="#C9E8FF" />
          <Circle cx="172" cy="161" r="25" fill="#173250" />
          <Circle cx="172" cy="161" r="12" fill="#C9E8FF" />
          <Rect x="47" y="115" width="37" height="14" rx="7" fill="#F3FAFF" opacity={0.92} />
          <Rect x="168" y="115" width="26" height="14" rx="7" fill="#FFCF5C" />
          <Path d="M101 51h45" stroke="#0B4FB5" strokeWidth="7" strokeLinecap="round" />
          <Path d="M51 139h145" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth="4" />
        </G>
      ) : null}

      {kind === "rocket" ? (
        <G>
          <Path
            d="M120 25c38 25 54 63 45 111l-45 39-45-39c-9-48 7-86 45-111Z"
            fill="url(#bank-blue)"
            stroke={primaryDark}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <Path
            d="m76 119-28 27-6 42 45-21M164 119l28 27 6 42-45-21"
            fill="#55B6FF"
            stroke={primaryDark}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <Circle cx="120" cy="91" r="24" fill="#DAF2FF" stroke="#0D58BB" strokeWidth="5" />
          <Circle cx="120" cy="91" r="15" fill="#7CC8FF" opacity={0.72} />
          <Path
            d="M102 169 93 204l27-19 27 19-9-35"
            fill="url(#bank-gold)"
            stroke="#E87810"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <Path d="M103 47c-11 17-16 32-18 47" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity={0.5} />
          <Rect x="101" y="128" width="38" height="7" rx="3.5" fill="#0A4DAA" />
        </G>
      ) : null}
    </Svg>
  );
}

export function PiggyBank({
  kind,
  size = 240,
  interactive = true,
  onPress,
}: {
  kind: PiggyKind;
  size?: number;
  interactive?: boolean;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const [float] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!interactive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1700,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, interactive]);

  const graphic = (
    <Animated.View
      style={{
        shadowColor: theme.primary,
        shadowOpacity: Platform.OS === "web" ? 0 : 0.25,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 16 },
        elevation: 12,
        transform: [
          {
            translateY: interactive
              ? float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, -8],
                })
              : 0,
          },
          {
            rotate: interactive
              ? float.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-0.7deg", "0.7deg"],
                })
              : "0deg",
          },
        ],
      }}
    >
      <PigGraphic kind={kind} size={size} />
    </Animated.View>
  );

  if (!onPress) {
    return <View style={styles.pressable}>{graphic}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Savings bank"
      style={({ pressed }) => [
        styles.pressable,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {graphic}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
});
