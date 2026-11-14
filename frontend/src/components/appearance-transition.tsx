import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";

export function AppearanceTransition() {
  const theme = useAppTheme();
  const language = useAppStore((state) => state.language);
  const [progress] = useState(() => new Animated.Value(0));
  const firstRender = useRef(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(0);
      return;
    }
    progress.setValue(1);
    Animated.timing(progress, {
      toValue: 0,
      duration: 420,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [language, progress, reduceMotion, theme.mode]);

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <LinearGradient
          colors={[
            String(theme.glassHighlight),
            String(theme.backgroundMiddle),
            "rgba(255,255,255,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    inset: 0,
    zIndex: 999,
  },
});
