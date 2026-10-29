import { useUiCopy } from "@/components/localized-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, type RefObject } from "react";
import { AccessibilityInfo, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";

const copy = {
  ru: { label: "Знакомство с Logic Coin", next: "Далее", back: "Назад", skip: "Пропустить", done: "Готово", steps: [
    ["Твоя банка", "Здесь видны твои накопления и прогресс к цели. Кнопки под банкой ведут к заработку и выводу средств."],
    ["Ежедневные челленджи", "Здесь появляются задания на сегодня и твой прогресс. Открой все челленджи, чтобы увидеть задания и условия наград."],
    ["Твой рейтинг", "Нажми на этот блок, чтобы открыть таблицу лидеров и сравнить свои результаты с другими участниками."]
  ] },
  en: { label: "Welcome to Logic Coin", next: "Next", back: "Back", skip: "Skip", done: "Done", steps: [
    ["Your savings jar", "See your savings and progress toward your goal. The buttons below lead to earning and withdrawals."],
    ["Daily challenges", "Find today's challenges and your progress here. Open all challenges to see tasks and reward conditions."],
    ["Your ranking", "Tap this block to open the leaderboard and compare your results with other participants."]
  ] },
  uz: { label: "Logic Coin bilan tanishuv", next: "Keyingi", back: "Orqaga", skip: "O‘tkazib yuborish", done: "Tayyor", steps: [
    ["Sening jamg‘armang", "Bu yerda jamg‘armang va maqsading sari natijang ko‘rinadi. Pastdagi tugmalar pul ishlash va yechib olishga olib boradi."],
    ["Kundalik sinovlar", "Bu yerda bugungi topshiriqlar va natijang ko‘rinadi. Topshiriqlar va mukofot shartlarini ko‘rish uchun barcha sinovlarni och."],
    ["Sening reytinging", "Yetakchilar jadvalini ochish va natijangni boshqa ishtirokchilar bilan solishtirish uchun shu blokni bos."]
  ] }
};
type Target = RefObject<View | null>;
export function HomeTutorial({ targets, scrollRef, scrollY, onActiveChange }: {
  targets: Target[]; scrollRef: RefObject<ScrollView | null>; scrollY: RefObject<number>; onActiveChange: (active: boolean) => void;
}) {
  const { copyContent } = useUiCopy();
  const theme = useAppTheme();
  const language = useAppStore(s => s.language) ?? "ru";
  const userId = useAppStore(s => s.user.id);
  const auth = useAppStore(s => s.authMode);
  const focused = useIsFocused();
  const key = auth === "authenticated" && userId ? `logic-coin:home-tour:v1:${userId}` : auth === "guest" ? "logic-coin:home-tour:v1:guest" : null;
  const c = copy[language];
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [cardHeight, setCardHeight] = useState(280);
  const [cardX] = useState(() => new Animated.Value(0));
  const [cardY] = useState(() => new Animated.Value(0));
  const [ready, setReady] = useState(false);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [bounds] = useState(() => ({ x: new Animated.Value(0), y: new Animated.Value(0), w: new Animated.Value(0), h: new Animated.Value(0) }));
  const [opacity] = useState(() => new Animated.Value(0));
  const active = focused && activeKey === key && key !== null;
  useEffect(() => {
    let cancelled = false;
    if (key) void AsyncStorage.getItem(key).then(value => { if (!cancelled) { setStep(0); setReady(false); setCheckedKey(key); if (value !== "done") setActiveKey(key); } }).catch(() => { if (!cancelled) setCheckedKey(key); });
    return () => { cancelled = true; };
  }, [key]);
  useEffect(() => { onActiveChange(active || Boolean(key && checkedKey !== key)); return () => onActiveChange(false); }, [active, key, checkedKey, onActiveChange]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    opacity.setValue(0);
    const measure = () => targets[step].current?.measureInWindow((x, y, w, h) => {
      if (cancelled || w <= 0 || h <= 0) return;
      const top = Math.max(12, Math.min(y - 6, height - 290));
      const values = { x: Math.max(8, x - 6), y: top, w: Math.min(w + 12, width - 16), h: Math.max(36, Math.min(h + 12, height - (width >= 1000 ? 24 : cardHeight + 40) - top)) };
      Animated.parallel(Object.entries(values).map(([name, value]) => Animated.timing(bounds[name as keyof typeof bounds], { toValue: value, duration: reduced || !ready ? 0 : 280, useNativeDriver: false }))).start();
      const cardWidth = Math.min(width >= 1000 ? 360 : 440, width - 32);
      Animated.parallel([
        Animated.timing(cardX, { toValue: width >= 1000 && step < 2 ? (step === 0 ? width - cardWidth - 28 : 28) : (width - cardWidth) / 2, duration: reduced || !ready ? 0 : 280, useNativeDriver: false }),
        Animated.timing(cardY, { toValue: width >= 1000 && step < 2 ? Math.min(120, height - cardHeight - 24) : height - cardHeight - 24, duration: reduced || !ready ? 0 : 280, useNativeDriver: false })
      ]).start();
      setReady(true);
      Animated.timing(opacity, { toValue: 1, duration: reduced ? 0 : 220, useNativeDriver: Platform.OS !== "web" }).start();
      AccessibilityInfo.announceForAccessibility(`${step + 1} / 3. ${c.steps[step][0]}. ${c.steps[step][1]}`);
    });
    timer = setTimeout(() => {
      targets[step].current?.measureInWindow((_x, y) => {
        if (cancelled) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + y - 80), animated: !reduced });
        timer = setTimeout(measure, reduced ? 50 : 450);
      });
    }, 100);
    return () => { cancelled = true; clearTimeout(timer); };
    // Target refs are stable; measuring again is needed only for the active step or viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, width, height, reduced, language, cardHeight]);
  const finish = () => {
    if (key) void AsyncStorage.setItem(key, "done").catch(() => {});
    setActiveKey(null); setReady(false); scrollRef.current?.scrollTo({ y: 0, animated: !reduced });
  };
  return <Modal visible={active} transparent animationType={reduced ? "none" : "fade"} onRequestClose={finish} statusBarTranslucent>
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {ready ? <>
        <Animated.View style={[styles.shade, { left: 0, right: 0, top: 0, height: bounds.y }]} />
        <Animated.View style={[styles.shade, { left: 0, top: bounds.y, width: bounds.x, height: bounds.h }]} />
        <Animated.View style={[styles.shade, { left: Animated.add(bounds.x, bounds.w), right: 0, top: bounds.y, height: bounds.h }]} />
        <Animated.View style={[styles.shade, { left: 0, right: 0, top: Animated.add(bounds.y, bounds.h), bottom: 0 }]} />
        <Animated.View pointerEvents="none" style={[styles.highlight, { left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h, borderColor: theme.primary }]} />
      </> : <View style={[StyleSheet.absoluteFill, styles.shade]} />}
      <Animated.View onLayout={event => setCardHeight(event.nativeEvent.layout.height)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, left: cardX, top: cardY, opacity: ready ? 1 : 0, width: Math.min(width >= 1000 ? 360 : 440, width - 32), maxHeight: height * 0.5 }]}>
        <ScrollView bounces={false}>
          <AppText muted style={styles.label}>{copyContent(c.label)} · {copyContent(step + 1)} / 3</AppText>
          <Animated.View style={{ opacity }}>
            <AppText accessibilityRole="header" style={styles.title}>{copyContent(c.steps[step][0])}</AppText>
            <AppText muted style={styles.body}>{copyContent(c.steps[step][1])}</AppText>
          </Animated.View>
        </ScrollView>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={finish} style={styles.secondary}><AppText muted>{copyContent(c.skip)}</AppText></Pressable>
          {step > 0 ? <Pressable accessibilityRole="button" onPress={() => setStep(s => s - 1)} style={styles.secondary}><AppText>{copyContent(c.back)}</AppText></Pressable> : null}
          <Pressable accessibilityRole="button" disabled={!ready} onPress={() => step === 2 ? finish() : setStep(s => s + 1)} style={({ pressed }) => [styles.next, { backgroundColor: theme.primary, opacity: pressed ? 0.82 : 1 }]}><AppText color={String(theme.onPrimary)} style={{ fontWeight: "700" }}>{copyContent(step === 2 ? c.done : c.next)}</AppText></Pressable>
        </View>
      </Animated.View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  shade: { position: "absolute", backgroundColor: "rgba(16,37,27,0.68)" },
  highlight: { position: "absolute", borderWidth: 3, borderRadius: 24 },
  card: { position: "absolute", alignSelf: "center", borderRadius: 26, borderWidth: 1, padding: 22, gap: 18 },
  label: { fontSize: 12, lineHeight: 18 }, title: { fontSize: 24, lineHeight: 30, fontWeight: "800", marginTop: 12 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 10 }, actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  secondary: { paddingVertical: 12, paddingHorizontal: 4 }, next: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 22 }
});
