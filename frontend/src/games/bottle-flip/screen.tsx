import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Easing, Image, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import { useTranslation } from "@/hooks/use-translation";
import { useGameProgressStore } from "@/games/progress-store";
import { evaluateSwipe } from "./engine";
import { BOTTLE_THEMES, BottleThemes } from "./themes";
const copies = {
  ru: { title: "Бутылка", hint: "Подбрось бутылку свайпом вверх", perfect: "Точно!", weak: "Чуть быстрее ↑", strong: "Чуть мягче ↑", side: "Бросай прямо ↑", retry: "Повторить", back: "Назад" },
  en: { title: "Bottle Flip", hint: "Swipe the bottle upward", perfect: "Perfect!", weak: "A little faster ↑", strong: "A little gentler ↑", side: "Throw straight ↑", retry: "Retry", back: "Back" },
  uz: { title: "Shisha", hint: "Shishani tepaga surib oting", perfect: "Ajoyib!", weak: "Biroz tezroq ↑", strong: "Biroz sekinroq ↑", side: "To‘g‘ri oting ↑", retry: "Qaytadan", back: "Orqaga" },
};
type Phase = "ready" | "dragging" | "flying" | "result";
type Result = NonNullable<ReturnType<typeof evaluateSwipe>>;
const initial: Result = { landed: false, verdict: "weak", rotation: 360, offsetX: 0, durationMs: 800, peak: 100 };
const steps = Array.from({ length: 11 }, (_, i) => i / 10);
export default function BottleFlipScreen() {
  const { language } = useTranslation(); const c = copies[language]; const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready"); const mode = useRef<Phase>("ready");
  const [result, setResult] = useState<Result>(initial);
  const score = useGameProgressStore((state) => state.games["bottle-flip"]?.coins ?? 0);
  const selectedTheme = useGameProgressStore((state) => state.games["bottle-flip"]?.selectedCosmetic ?? "classic");
  const hydrated = useGameProgressStore((state) => state.hydrated);
  const preparePricing = useGameProgressStore((state) => state.prepareBottleThemePricing);
  useEffect(() => { if (hydrated) preparePricing(); }, [hydrated, preparePricing]);
  const art = BOTTLE_THEMES.find((item) => item.id === selectedTheme) ?? BOTTLE_THEMES[0];
  const [themesOpen, setThemesOpen] = useState(false);
  const size = useRef({ width: 340, height: 440 });
  const [sceneHeight, setSceneHeight] = useState(440);
  const trail = useRef<{ x: number; y: number; time: number }[]>([]);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flight] = useState(() => new Animated.Value(0)); const [settle] = useState(() => new Animated.Value(0)); const [drag] = useState(() => new Animated.Value(0));
  const recordScore = useGameProgressStore((state) => state.recordScore);
  const change = useCallback((value: Phase) => { mode.current = value; setPhase(value); }, []);
  const reset = useCallback(() => {
    if (restartTimer.current !== null) { clearTimeout(restartTimer.current); restartTimer.current = null; }
    mode.current = "ready"; flight.stopAnimation(); settle.stopAnimation(); drag.stopAnimation();
    flight.setValue(0); settle.setValue(0); drag.setValue(0); trail.current = []; setPhase("ready");
  }, [flight, settle, drag]);
  useFocusEffect(useCallback(() => {
    const sub = AppState.addEventListener("change", (state) => { if (state !== "active") reset(); });
    return () => { sub.remove(); reset(); };
  }, [reset]));
  const toss = useCallback((dx: number, dy: number, durationMs: number) => {
    const next = evaluateSwipe({ dx, dy, durationMs, sceneHeight: size.current.height, sceneWidth: size.current.width });
    drag.setValue(0); if (!next) { change("ready"); return; }
    setResult(next); change("flying");
    Animated.timing(flight, { toValue: 1, duration: next.durationMs, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
      if (!finished || mode.current !== "flying") return;
      Animated.timing(settle, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(({ finished: done }) => {
        if (!done || mode.current !== "flying") return;
        if (next.landed) recordScore("bottle-flip", 100, "Bottle flip", true);
        change("result");
        restartTimer.current = setTimeout(reset, 900);
      });
    });
  }, [change, drag, flight, settle, recordScore, reset]);
  // PanResponder stores these callbacks; it does not execute them while rendering.
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => mode.current === "ready",
    onPanResponderGrant: (_, g) => { trail.current = [{ x: g.x0, y: g.y0, time: performance.now() }]; change("dragging"); },
    onPanResponderMove: (_, g) => {
      if (mode.current !== "dragging") return;
      const now = performance.now(); trail.current.push({ x: g.moveX, y: g.moveY, time: now });
      trail.current = trail.current.filter((point) => now - point.time <= 180).slice(-20);
      drag.setValue(Math.max(-18, Math.min(8, g.dy * 0.1)));
    },
    onPanResponderRelease: (_, g) => {
      if (mode.current !== "dragging") return;
      if (g.dy >= -12) { reset(); return; }
      const now = performance.now(); const first = trail.current.find((point) => now - point.time <= 200);
      if (!first) { reset(); return; }
      // Holding still does not accumulate force; only the recent swipe supplies impulse.
      toss(g.moveX - first.x, g.moveY - first.y, now - first.time);
    },
    onPanResponderTerminate: reset, onPanResponderTerminationRequest: () => false,
  }), [change, drag, reset, toss]);
  /* eslint-enable react-hooks/refs, react-hooks/purity */
  const finalAngle = result.landed ? 360 : Math.round(result.rotation / 360) * 360 + 90;
  const airborneY = flight.interpolate({ inputRange: steps, outputRange: steps.map((t) => -4 * result.peak * t * (1 - t)) });
  const rotation = Animated.add(flight.interpolate({ inputRange: [0, 1], outputRange: [0, result.rotation] }), settle.interpolate({ inputRange: [0, 1], outputRange: [0, finalAngle - result.rotation] })).interpolate({ inputRange: [0, 1440], outputRange: ["0deg", "1440deg"] });
  return <SafeAreaView style={[styles.page, { backgroundColor: art.background }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={c.back} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/games")} style={styles.iconButton}><Ionicons name="chevron-back" size={25} color={art.foreground} /></Pressable>
      <AppText style={[styles.title, { color: art.foreground }]}>{c.title}</AppText>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Темы" onPress={() => { reset(); setThemesOpen(true); }} style={styles.iconButton}><Ionicons name="shirt-outline" size={22} color={art.foreground} /></Pressable>
        <View style={styles.counter}><Ionicons name="diamond-outline" size={18} color={art.foreground} /><AppText style={[styles.score, { color: art.foreground }]}>{score} coin</AppText></View>
      </View>
    </View>
    <View style={styles.scene} onLayout={(event) => { size.current = event.nativeEvent.layout; setSceneHeight(event.nativeEvent.layout.height); }}>
      <Image source={art.room} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} resizeMode="stretch" />
      <View pointerEvents="none" style={[styles.shadow, { top: sceneHeight * 0.88 - 4 }]} />
      <Animated.View {...responder.panHandlers} accessibilityLabel={c.hint} style={[styles.bottle, { top: sceneHeight * 0.88 - 210, transform: [
        { translateX: flight.interpolate({ inputRange: [0, 1], outputRange: [0, result.offsetX] }) },
        { translateY: Animated.add(Animated.add(airborneY, drag), settle.interpolate({ inputRange: [0, 1], outputRange: [0, result.landed ? 0 : 50] })) }, { rotate: rotation },
      ] }]}><Image source={art.bottle} style={styles.bottleArt} resizeMode="contain" /></Animated.View>
    </View>
    <AppText style={[styles.hint, { color: phase === "result" && result.landed ? art.success : art.foreground }]}>{phase === "result" ? c[result.verdict] : c.hint}</AppText>
    <BottleThemes visible={themesOpen} onClose={() => setThemesOpen(false)} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 14 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, title: { fontSize: 23, fontWeight: "800" },
  counter: { flexDirection: "row", gap: 6, minWidth: 48, alignItems: "center", justifyContent: "center" }, score: { fontSize: 21, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  scene: { flex: 1, minHeight: 260, borderRadius: 32, overflow: "hidden", alignItems: "center", justifyContent: "flex-end" },
  bottle: { position: "absolute", width: 140, height: 210, alignItems: "center", justifyContent: "center" }, bottleArt: { width: 140, height: 210 },
  shadow: { position: "absolute", width: 60, height: 9, borderRadius: 30, backgroundColor: "#43322633" },
  hint: { textAlign: "center", fontSize: 16, fontWeight: "600", marginVertical: 18, minHeight: 24 },
});
