import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useEffect, useState, type PropsWithChildren } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChatCopy } from "@/lib/chat-copy";
export type ChatAnchor = { x: number; y: number };
export function ChatPopover({ anchor, closing, onClose, onClosed, children }: PropsWithChildren<{
  anchor: ChatAnchor;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
}>) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reducedMotion ? 1 : 0.55));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: closing ? 0 : 1,
      duration: reducedMotion ? 0 : closing ? 130 : 145,
      easing: closing ? Easing.in(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start(({ finished }) => { if (finished && closing) onClosed(); });
    return () => animation.stop();
  }, [closing, onClosed, progress, reducedMotion]);
  const { width, height } = useWindowDimensions(), theme = useAppTheme(), c = useChatCopy();
  const menuWidth = Math.min(290, width - 32), menuHeight = Math.min(460, height - 100);
  const top = Math.max(16, Math.min((Number.isFinite(anchor.y) ? anchor.y : height / 2) + 8, height - menuHeight - 16));
  const left = Math.max(16, Math.min((Number.isFinite(anchor.x) ? anchor.x : width / 2) - menuWidth / 2, width - menuWidth - 16));
  return <Modal transparent visible animationType="none" onRequestClose={onClose}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityLabel={c.cancel} disabled={closing} onPress={onClose} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal pointerEvents={closing ? "none" : "auto"} style={{ position: "absolute", top, left, width: menuWidth, opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [13, 0] }) }], maxHeight: menuHeight, padding: 6, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceRaised, boxShadow: "0 8px 30px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 3 }} testID="message-actions-menu">{children}</ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
