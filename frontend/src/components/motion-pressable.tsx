import { useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
export function MotionPressable({
  children,
  containerStyle,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "children"> & {
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => () => scale.stopAnimation(), [scale]);
  const animate = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      damping: 18,
      stiffness: 320,
      mass: 0.5,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };
  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        onPressIn={(event) => {
          if (!reduced) animate(0.96);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          if (!reduced) animate(1);
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
