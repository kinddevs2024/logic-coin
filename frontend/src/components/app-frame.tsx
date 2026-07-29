import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "expo-router";
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
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import Reanimated, {
  FadeInDown,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";

import { GlassBlurTargetContext } from "@/components/glass-blur-target";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

function AmbientOrbs() {
  const theme = useAppTheme();
  const { isDesktop } = useResponsiveLayout();
  const [drift] = useState(() => new Animated.Value(0));
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (reduceMotion || !isFocused) {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
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
  }, [drift, isFocused, reduceMotion]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[
          String(theme.backgroundStart),
          String(theme.backgroundMiddle),
          String(theme.backgroundEnd),
        ]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbTop,
          isDesktop && styles.orbTopDesktop,
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
          isDesktop && styles.orbBottomDesktop,
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
      <Animated.View
        style={[
          styles.orb,
          styles.orbMiddle,
          isDesktop && styles.orbMiddleDesktop,
          {
            backgroundColor: theme.glassHighlight,
            transform: [
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 18],
                }),
              },
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, -14],
                }),
              },
            ],
          },
        ]}
      />
      <LinearGradient
        colors={[
          "rgba(255,255,255,0.5)",
          "rgba(255,255,255,0.02)",
          "rgba(73,164,255,0.08)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.sheen}
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
  desktopNavigationInset?: boolean;
}>;

export function AppFrame({
  children,
  scroll = true,
  contentStyle,
  scrollProps,
  wide,
  noPadding,
  desktopNavigationInset,
}: AppFrameProps) {
  const theme = useAppTheme();
  const { isDesktop, isTablet } = useResponsiveLayout();
  const blurTarget = useRef<View | null>(null);
  const content = [
    styles.content,
    {
      maxWidth: wide
        ? isDesktop
          ? 1180
          : isTablet
            ? 920
            : 720
        : isTablet
          ? 760
          : 720,
      paddingHorizontal: noPadding ? 0 : isDesktop ? 32 : isTablet ? 24 : 20,
      paddingTop: isDesktop ? 22 : 12,
      paddingBottom:
        desktopNavigationInset && isDesktop
          ? 48
          : Platform.OS === "web"
            ? 120
            : 132,
    },
    contentStyle,
  ];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
        <AmbientOrbs />
      </BlurTargetView>
      <GlassBlurTargetContext.Provider value={blurTarget}>
        <Reanimated.View
          entering={FadeInDown.duration(360)
            .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })
            .reduceMotion(ReduceMotion.System)}
          style={[
            styles.animatedContent,
            desktopNavigationInset &&
              isDesktop &&
              styles.animatedContentDesktopNavigation,
          ]}
        >
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
        </Reanimated.View>
      </GlassBlurTargetContext.Provider>
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
  animatedContent: {
    flex: 1,
  },
  animatedContentDesktopNavigation: {
    paddingLeft: 112,
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
    width: 270,
    height: 270,
    top: -110,
    right: -90,
  },
  orbBottom: {
    width: 320,
    height: 320,
    left: -150,
    bottom: 20,
    opacity: 0.23,
  },
  orbBottomDesktop: {
    width: 520,
    height: 520,
    left: -190,
    bottom: -80,
  },
  orbMiddle: {
    width: 190,
    height: 190,
    top: "36%",
    right: -118,
    opacity: 0.18,
  },
  orbMiddleDesktop: {
    width: 320,
    height: 320,
    right: -80,
  },
  orbTopDesktop: {
    width: 440,
    height: 440,
    top: -190,
    right: -70,
  },
  sheen: {
    position: "absolute",
    width: "150%",
    height: 180,
    top: 60,
    left: "-25%",
    transform: [{ rotate: "-9deg" }],
    opacity: 0.42,
  },
});
