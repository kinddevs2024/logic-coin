import { BlurTargetView } from "expo-blur";
import { useNavigation } from "expo-router";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Animated, Easing, Platform, StyleSheet, type View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { GlassBlurTargetContext, ScreenBlurTargetContext } from "@/components/glass-blur-target";

// Each screen's modal uses its own stable target. A focus change doesn't need
// to update context for the other, still-mounted screens.
export function NavigationBlurScene({ children }: PropsWithChildren) {
  if (Platform.OS !== "android") return children;
  return <AndroidNavigationScene>{children}</AndroidNavigationScene>;
}

function AndroidNavigationScene({ children }: PropsWithChildren) {
  const target = useRef<View | null>(null);
  const navigation = useNavigation();
  const reduceMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));
  const [motion] = useState(() => ({
    transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  }));

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    let animation: Animated.CompositeAnimation | undefined;
    let shownForFocus = false;
    const show = () => {
      if (shownForFocus) return;
      shownForFocus = true;
      animation?.stop();
      progress.setValue(0);
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      });
      animation.start();
    };
    const unsubscribeFocus = navigation.addListener("focus", show);
    const unsubscribeBlur = navigation.addListener("blur", () => {
      shownForFocus = false;
      animation?.stop();
      progress.setValue(1);
    });
    if (navigation.isFocused()) show();
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      animation?.stop();
      progress.setValue(1);
    };
  }, [navigation, progress, reduceMotion]);

  return (
    <ScreenBlurTargetContext.Provider value={target}>
      <GlassBlurTargetContext.Provider value={target}>
        <Animated.View style={[styles.scene, motion]}>
          <BlurTargetView ref={target} style={styles.scene}>{children}</BlurTargetView>
        </Animated.View>
      </GlassBlurTargetContext.Provider>
    </ScreenBlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({ scene: { flex: 1 } });
