import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGameProgressStore } from "@/games/progress-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AppText } from "@/components/app-text";
import { useTranslation } from "@/hooks/use-translation";
import { BOTTLE_THEME_PRICES, bottleThemeOwnership } from "./pricing";
export const BOTTLE_THEMES = [
  { id: "classic", color: "#0E7490", background: "#DCEFF9", foreground: "#123C53", success: "#15703C", bottle: require("../../../assets/bottle-flip.png"), room: require("../../../assets/bottle-room.png") },
  { id: "amber", color: "#C56E16", background: "#FFE5B5", foreground: "#633509", success: "#15703C", bottle: require("../../../assets/bottle-amber.png"), room: require("../../../assets/bottle-room-amber.png") },
  { id: "violet", color: "#7C3AED", background: "#39265C", foreground: "#F4EFFF", success: "#8FF0BC", bottle: require("../../../assets/bottle-violet.png"), room: require("../../../assets/bottle-room-violet.png") },
] as const;
const themePrice = (id: string) => BOTTLE_THEME_PRICES[id] ?? 0;
export function BottleThemes({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const selected = useGameProgressStore((state) => state.games["bottle-flip"]?.selectedCosmetic ?? "classic");
  const pricingVersion = useGameProgressStore((state) => state.games["bottle-flip"]?.bottleThemePricingVersion);
  const hydrated = useGameProgressStore((state) => state.hydrated);
  const prepare = useGameProgressStore((state) => state.prepareBottleThemePricing);
  useEffect(() => { if (visible && hydrated) prepare(); }, [visible, hydrated, prepare]);
  const select = useGameProgressStore((state) => state.purchaseCosmetic);
  const coins = useGameProgressStore((state) => state.games["bottle-flip"]?.coins ?? 0);
  const unlocked = useGameProgressStore((state) => state.games["bottle-flip"]?.unlockedCosmetics);
  if (!visible) return null;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}><View style={[styles.panel, { backgroundColor: theme.surfaceRaised }]}>
      <View style={styles.header}><AppText style={styles.title}>{language === "ru" ? "Темы" : language === "en" ? "Themes" : "Mavzular"}</AppText><Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose} style={styles.close}><Ionicons name="close" size={26} color={theme.text} /></Pressable></View>
      <View style={styles.row}>{BOTTLE_THEMES.map((item) => {
        const price = themePrice(item.id);
        const ownership = bottleThemeOwnership({ bottleThemePricingVersion: pricingVersion, selectedCosmetic: selected, unlockedCosmetics: unlocked });
        const owned = ownership.unlockedCosmetics.includes(item.id);
        const available = owned || coins >= price;
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Тема ${item.id}${owned ? "" : `: ${price} coin`}`} disabled={!available} accessibilityState={{ selected: selected === item.id, disabled: !available }} onPress={() => { if (select("bottle-flip", item.id, price)) onClose(); }} style={[styles.card, { borderColor: selected === item.id ? item.color : "transparent" }]}>
        <Image source={item.room} style={styles.room} resizeMode="stretch" /><Image source={item.bottle} style={styles.bottle} resizeMode="contain" />
        {selected === item.id ? <View style={[styles.check, { backgroundColor: item.color }]}><Ionicons name="checkmark" color="white" size={18} /></View> : null}
        {!owned ? <View style={{ position: "absolute", bottom: 5, flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: "#18263DDD", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 }}><Ionicons name={available ? "diamond-outline" : "lock-closed-outline"} size={13} color="white" /><AppText style={{ fontSize: 12, fontWeight: "800", color: "white" }}>{price}</AppText></View> : null}
      </Pressable>; })}</View>
    </View></SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "#00000066" }, panel: { borderRadius: 28, padding: 14 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, title: { fontSize: 21, fontWeight: "800", paddingLeft: 6 }, close: { padding: 8 }, row: { flexDirection: "row", gap: 8 }, card: { flex: 1, height: 190, borderRadius: 20, borderWidth: 3, overflow: "hidden", alignItems: "center", justifyContent: "flex-end" }, room: { position: "absolute", width: "100%", height: "100%" }, bottle: { width: 76, height: 128, marginBottom: 18 }, check: { position: "absolute", top: 6, right: 6, borderRadius: 12, padding: 3 } });
