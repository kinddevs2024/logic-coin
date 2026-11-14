import { useEffect, useState, type PropsWithChildren } from "react";
import { Animated, Platform, type ViewProps } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
export function MotionEntrance({
  children,
  ...props
}: PropsWithChildren<ViewProps>) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 260,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return (
    <Animated.View
      {...props}
      style={[
        props.style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
