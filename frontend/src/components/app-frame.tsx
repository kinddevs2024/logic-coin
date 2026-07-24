import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type PropsWithChildren } from "react";

import { useAppTheme } from "@/hooks/use-app-theme";

function AmbientOrbs() {
  const theme = useAppTheme();
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 6500,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 6500,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.orb,
          styles.orbTop,
          {
            backgroundColor: theme.orbOne,
            transform: [
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 26],
                }),
              },
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -18],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbBottom,
          {
            backgroundColor: theme.orbTwo,
            transform: [
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, -20],
                }),
              },
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 18],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

type AppFrameProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
  wide?: boolean;
  noPadding?: boolean;
}>;

export function AppFrame({
  children,
  scroll = true,
  contentStyle,
  scrollProps,
  wide,
  noPadding,
}: AppFrameProps) {
  const theme = useAppTheme();
  const content = [
    styles.content,
    {
      maxWidth: wide ? 1040 : 720,
      paddingHorizontal: noPadding ? 0 : 20,
    },
    contentStyle,
  ];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <AmbientOrbs />
      {scroll ? (
        <ScrollView
          {...scrollProps}
          role="main"
          style={styles.scroll}
          contentContainerStyle={content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View role="main" style={content}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: "100%",
    alignSelf: "center",
    paddingTop: 12,
    paddingBottom: Platform.OS === "web" ? 120 : 132,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.34,
    ...(Platform.OS === "web"
      ? ({ filter: "blur(46px)" } as unknown as ViewStyle)
      : {}),
  },
  orbTop: {
    width: 210,
    height: 210,
    top: -72,
    right: -74,
  },
  orbBottom: {
    width: 260,
    height: 260,
    left: -130,
    bottom: 80,
    opacity: 0.2,
  },
});
