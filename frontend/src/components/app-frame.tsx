import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "expo-router";
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode, type RefObject } from "react";
import Reanimated, {
  FadeInDown,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";

import { GlassBlurTargetContext } from "@/components/glass-blur-target";
import { AndroidSoftGlow } from "@/components/android-soft-glow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useDesktopTabWheel } from "@/hooks/use-desktop-tab-wheel";
import { useTabSwipe } from "@/hooks/use-tab-swipe";

function AmbientOrbs() {
  const theme = useAppTheme();
  const { isDesktop } = useResponsiveLayout();
  const [drift] = useState(() => new Animated.Value(0));
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (Platform.OS === "android" || reduceMotion || !isFocused) {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 9800,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 9800,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift, isFocused, reduceMotion]);

  if (theme.wallpaperUrl) return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Image source={{uri:theme.wallpaperUrl}} resizeMode="cover" style={StyleSheet.absoluteFill}/>
    <View style={[StyleSheet.absoluteFill,{backgroundColor:theme.mode === "dark" ? "rgba(0,0,0,0.52)" : "rgba(255,255,255,0.62)"}]}/>
  </View>;
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
            backgroundColor: Platform.OS === "android" ? "transparent" : theme.orbOne,
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
      >
        {Platform.OS === "android" ? <AndroidSoftGlow color={theme.orbOne} diameter={isDesktop ? 440 : 270} blurRadius={46} /> : null}
      </Animated.View>
      <Animated.View
        style={[
          styles.orb,
          styles.orbBottom,
          isDesktop && styles.orbBottomDesktop,
          {
            backgroundColor: Platform.OS === "android" ? "transparent" : theme.orbTwo,
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
      >
        {Platform.OS === "android" ? <AndroidSoftGlow color={theme.orbTwo} diameter={isDesktop ? 520 : 320} blurRadius={46} /> : null}
      </Animated.View>
      <Animated.View
        style={[
          styles.orb,
          styles.orbMiddle,
          isDesktop && styles.orbMiddleDesktop,
          {
            backgroundColor: Platform.OS === "android" ? "transparent" : theme.glassHighlight,
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
      >
        {Platform.OS === "android" ? <AndroidSoftGlow color={theme.glassHighlight} diameter={isDesktop ? 320 : 190} blurRadius={46} /> : null}
      </Animated.View>
      <LinearGradient
        colors={[
          theme.mode === "dark" ? "rgba(0,122,87,0.07)" : "rgba(255,255,255,0.5)",
          theme.mode === "dark" ? "rgba(0,122,87,0.02)" : "rgba(255,255,255,0.02)",
          theme.mode === "dark" ? "rgba(0,122,87,0)" : "rgba(0,122,87,0.08)",
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
  fixedHeader?: ReactNode;
  contentStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
  scrollRef?: RefObject<ScrollView | null>;
  renderScrollContent?: (contentContainerStyle: StyleProp<ViewStyle>) => ReactNode;
  wide?: boolean;
  noPadding?: boolean;
  desktopNavigationInset?: boolean;
  onOpenProfile?: () => void;
  onSwipeRefresh?: () => void;
  swipesDisabled?: boolean;
  animateEntrance?: boolean;
}>;

export function AppFrame({
  children,
  fixedHeader,
  scroll = true,
  contentStyle,
  scrollProps,
  scrollRef,
  renderScrollContent,
  wide,
  noPadding,
  desktopNavigationInset,
  onOpenProfile,
  onSwipeRefresh,
  swipesDisabled,
  animateEntrance = true,
}: AppFrameProps) {
  const swipeHandlers = useTabSwipe({ disabled: swipesDisabled, onOpenProfile, onRefresh: onSwipeRefresh });
  const wheelRootRef = useDesktopTabWheel({ disabled: swipesDisabled });
  const theme = useAppTheme();
  const { isDesktop, isTablet } = useResponsiveLayout();
  const blurTarget = useRef<View | null>(null);
  const [fixedHeaderHeight, setFixedHeaderHeight] = useState(0);
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
  // Only controls float over the scroll viewport. Empty space lets content and gestures through.
  const header = fixedHeader ? (
    <View pointerEvents={Platform.OS === "web" ? "none" : "box-none"} testID="app-fixed-header-layer" style={[
      styles.fixedHeaderLayer,
      desktopNavigationInset && isDesktop && { left: 130 },
    ]}>
      <View pointerEvents={Platform.OS === "web" ? "none" : "box-none"} onLayout={event => setFixedHeaderHeight(event.nativeEvent.layout.height)}
        style={[content, { paddingBottom: 0 }]}>
        {fixedHeader}
      </View>
    </View>
  ) : null;
  // Android keeps the cutout safe area even when the system status bar is hidden.
  // Blend only the first 12 dp of scrolling content; the floating buttons stay crisp.
  const edgeColor = String(theme.backgroundStart);
  const topFade = Platform.OS === "android" && fixedHeader ? (
    <LinearGradient
      pointerEvents="none"
      testID="android-home-top-fade"
      colors={[edgeColor, /^#[0-9a-f]{6}$/i.test(edgeColor) ? `${edgeColor}00` : "transparent"]}
      style={styles.nativeTopFade}
    />
  ) : null;
  const scrollContent = fixedHeader ? [content, { paddingTop: fixedHeaderHeight }] : content;
  // Virtualized screens own the scroll container while sharing the same insets,
  // background and swipe handlers. Never nest their list inside a ScrollView.
  const body = renderScrollContent ? renderScrollContent(scrollContent) : scroll ? (
    <ScrollView
      {...scrollProps}
      ref={scrollRef}
      role="main"
      style={styles.scroll}
      contentContainerStyle={scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View role="main" style={scrollContent}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      ref={wheelRootRef}
      {...swipeHandlers}
      style={[styles.safe, { backgroundColor: theme.background },
        Platform.OS === "web" && !scroll ? ({ overflow: "clip" } as unknown as ViewStyle) : null]}
      edges={["top", "left", "right"]}
    >
      <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
        <AmbientOrbs />
      </BlurTargetView>
      <GlassBlurTargetContext.Provider value={blurTarget}>
        {Platform.OS === "web" || !animateEntrance ? (
          <View
            style={[
              styles.animatedContent,
              desktopNavigationInset &&
                isDesktop &&
                styles.animatedContentDesktopNavigation,
            ]}
          >
            {body}
            {Platform.OS !== "web" ? topFade : null}
            {header}
          </View>
        ) : (
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
            {body}
            {topFade}
            {header}
          </Reanimated.View>
        )}
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
  nativeTopFade: { position: "absolute", top: 0, left: 0, right: 0, height: 12, zIndex: 19 },
  fixedHeaderLayer: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
  animatedContent: {
    flex: 1,
  },
  animatedContentDesktopNavigation: {
    paddingLeft: 130,
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
    opacity: 0.2,
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
    opacity: 0.14,
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
    opacity: 0.1,
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
    opacity: 0.18,
  },
});
