import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, View } from "react-native";
import { useIsFocused } from "expo-router";
import { Avatar } from "./avatar";
import { AppText } from "./app-text";

type Friend = { id: string; name: string; avatarUrl?: string | null };
const decorations = ["👩🏻", "🧑🏽", "👨🏼", "👩🏾", "🧑🏻"];
const colors = ["#CDE9FF", "#DFD5FF", "#C3F2EC", "#FFE4BB", "#FBD5E5"];
const slots = [
  { x: [0.02, 0.15, 0.08, 0.02], y: [32, 8, 47, 32], size: 48 },
  { x: [0.23, 0.34, 0.20, 0.23], y: [4, 39, 23, 4], size: 44 },
  { x: [0.49, 0.40, 0.56, 0.49], y: [42, 16, 3, 42], size: 56 },
  { x: [0.73, 0.63, 0.78, 0.73], y: [2, 41, 28, 2], size: 46 },
  { x: [0.98, 0.86, 0.95, 0.98], y: [39, 18, 2, 39], size: 48 },
];

function Bubble({ friend, index, width, moving }: { friend?: Friend; index: number; width: number; moving: boolean }) {
  const [phase] = useState(() => new Animated.Value(0));
  const slot = slots[index]!;
  useEffect(() => {
    if (!moving) return;
    const animation = Animated.loop(Animated.timing(phase, {
      toValue: 1, duration: 11000 + index * 1700,
      easing: Easing.linear, useNativeDriver: Platform.OS !== "web", isInteraction: false,
    }));
    animation.start();
    return () => { animation.stop(); phase.setValue(0); };
  }, [moving, index, phase]);
  return (
    <Animated.View style={[styles.bubble, {
      width: slot.size, height: slot.size, borderRadius: slot.size / 2,
      backgroundColor: colors[index],
      transform: [
        { translateX: phase.interpolate({ inputRange: [0, 1 / 3, 2 / 3, 1], outputRange: slot.x.map(x => x * Math.max(0, width - slot.size)) }) },
        { translateY: phase.interpolate({ inputRange: [0, 1 / 3, 2 / 3, 1], outputRange: slot.y }) },
      ],
    }]}>
      {friend ? <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size={slot.size - 4} /> :
        <AppText style={{ fontSize: slot.size * 0.58, lineHeight: slot.size - 4 }}>{decorations[index]}</AppText>}
    </Animated.View>
  );
}

/** Decorative placeholders never enter referral counts or the real friend list. */
export function InviteAvatarBubbles({ friends }: { friends: readonly Friend[] }) {
  const focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    const state = AppState.addEventListener("change", value => setActive(value === "active"));
    return () => { mounted = false; motion.remove(); state.remove(); };
  }, []);
  const visible = friends.length ? friends.slice(0, 5) : decorations.map(() => undefined);
  return (
    <View testID="invite-avatar-bubbles" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.field}>
      {width > 0 ? visible.map((friend, index) => <Bubble key={friend?.id ?? `decoration-${index}`} friend={friend} index={index} width={width} moving={focused && active && !reduced} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { width: "100%", maxWidth: 420, height: 106, overflow: "hidden", marginBottom: 4 },
  bubble: { position: "absolute", left: 0, top: 0, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
