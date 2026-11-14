import { Modal, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { cardScannerCopy } from "@/lib/card-scanner-copy";

export function CardScannerShell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const theme = useAppTheme(); const { language } = useTranslation(); const c = cardScannerCopy[language];
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={[styles.panel, { backgroundColor: theme.surfaceRaised }]}>
      <View style={styles.header}><AppText variant="heading" style={{ flex: 1 }}>{c.title}</AppText><Pressable accessibilityRole="button" accessibilityLabel={c.close} onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={String(theme.text)} /></Pressable></View>
      {children}
      <AppText variant="caption" muted>{c.privacy}</AppText>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.7)", justifyContent: "center", padding: 16 }, panel: { width: "100%", maxWidth: 560, alignSelf: "center", borderRadius: 24, padding: 20, gap: 16 }, header: { flexDirection: "row", alignItems: "center", gap: 8 }, close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" } });
