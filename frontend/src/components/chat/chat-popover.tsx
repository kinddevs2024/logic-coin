import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import type { PropsWithChildren } from "react";
import { MotionEntrance } from "@/components/motion-entrance";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChatCopy } from "@/lib/chat-copy";
export type ChatAnchor = { x: number; y: number };
export function ChatPopover({ anchor, onClose, children }: PropsWithChildren<{ anchor: ChatAnchor; onClose: () => void }>) {
  const { width, height } = useWindowDimensions(), theme = useAppTheme(), c = useChatCopy();
  const menuWidth = Math.min(290, width - 32), menuHeight = Math.min(460, height - 100);
  const top = Math.max(16, Math.min((Number.isFinite(anchor.y) ? anchor.y : height / 2) + 8, height - menuHeight - 16));
  const left = Math.max(16, Math.min((Number.isFinite(anchor.x) ? anchor.x : width / 2) - menuWidth / 2, width - menuWidth - 16));
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityLabel={c.cancel} onPress={onClose} style={StyleSheet.absoluteFill} />
      <MotionEntrance accessibilityViewIsModal style={{ position: "absolute", top, left, width: menuWidth, maxHeight: menuHeight, padding: 6, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceRaised, boxShadow: "0 8px 30px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 3 }} testID="message-actions-menu">{children}</ScrollView>
      </MotionEntrance>
    </View>
  </Modal>;
}
