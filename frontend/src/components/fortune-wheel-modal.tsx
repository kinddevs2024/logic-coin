import { useUiCopy } from "@/components/localized-native";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons';
import { NotebookLayer, NotebookPaper, Hand, notebookPanel } from '../games/hangman/notebook';
import { endCopy, NotebookAction } from '../games/hangman/result';
import { useAppStore } from '../store/app-store';

const NOTEBOOK_PRIZES = ['+200', '+150', '+200', '+100', '+50'];
const invitation = {
  ru: 'Больше коинов? Испытай удачу!',
  uz: 'Ko‘proq koin? Omadingizni sinang!',
  en: 'More coins? Try your luck!',
};

const WHEEL_SIZE = 272;
const WHEEL_CENTER = WHEEL_SIZE / 2;
const PRIZES = [
  { label: "+1000", caption: "ДЖЕКПОТ" },
  { label: "+500", caption: "БОНУС" },
  { label: "+200", caption: "COIN" },
  { label: "+150", caption: "COIN" },
  { label: "+50", caption: "COIN" },
] as const;

function polar(angle: number, radius: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: WHEEL_CENTER + radius * Math.cos(radians), y: WHEEL_CENTER + radius * Math.sin(radians) };
}

export function FortuneWheelModal({ visible, selected, spinning, busy, notice, onSpin, onSpinEnd, onDismiss, paper = false }: {
  paper?: boolean;
  visible: boolean;
  selected: string | null;
  spinning: boolean;
  busy: boolean;
  notice?: string;
  onSpin: () => void;
  onSpinEnd: () => void;
  onDismiss: () => void;
}) {
  const { copyText, copyContent } = useUiCopy();
  const language = useAppStore(state => state.language) ?? 'ru';
  const c = endCopy[language];
  const [rotation] = useState(() => new Animated.Value(0));
  const onEnd = useRef(onSpinEnd);
  useEffect(() => { onEnd.current = onSpinEnd; }, [onSpinEnd]);
  const prizeIndex = Math.max(0, paper ? NOTEBOOK_PRIZES.indexOf(selected ?? "") : PRIZES.findIndex(prize => prize.label === selected));
  const finalAngle = 1440 + (360 - (prizeIndex * 72 + 36));
  const prizePositions = useMemo(() => PRIZES.map((_, index) => polar(index * 72 + 36, 88)), []);
  useEffect(() => {
    if (!spinning) return;
    rotation.setValue(0);
    const animation = Animated.timing(rotation, { toValue: 1, duration: 1500, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) onEnd.current(); });
    return () => animation.stop();
  }, [rotation, spinning]);
  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!busy && !spinning) onDismiss();
      return true;
    });
    return () => listener.remove();
  }, [visible, busy, spinning, onDismiss]);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${finalAngle}deg`] });
  if (!visible) return null;
  if (paper) return <NotebookLayer priority={2000} onClose={() => { if (!busy && !spinning) onDismiss(); }}><NotebookPaper style={[notebookPanel, { top: 190, padding: 32, alignItems: 'center' }]}>
    <Hand style={{ fontSize: 45, textAlign: 'center', color: '#111' }}>{copyContent(c.wheel)}</Hand>
    <Hand style={{ fontSize: 25, textAlign: 'center', marginTop: 10 }}>{invitation[language]}</Hand>
    <Ionicons name="caret-down" size={38} color="#F54763" style={{ marginTop: 18, marginBottom: -5, zIndex: 2 }} />
    <Animated.View style={[styles.wheel, { transform: [{ rotate: spin }], shadowOpacity: 0, marginBottom: 15 }]}>
      <Image source={require("../../assets/images/fortune-wheel-v2.png")} resizeMode="contain" style={styles.wheelArtwork} />
      {NOTEBOOK_PRIZES.map((prize, index) => <View key={index} pointerEvents="none" style={[styles.prizeBlock, { left: prizePositions[index].x - 40, top: prizePositions[index].y - 25 }]}><Hand style={{ color: '#FFF', fontSize: 27 }}>{copyContent(prize)}</Hand></View>)}
      <View style={styles.hub}><Image source={require("../../assets/brand/logo-mark.png")} resizeMode="contain" style={styles.hubImage} /></View>
    </Animated.View>
    {selected && !spinning ? <Hand style={{ fontSize: 34 }}>{copyContent(selected)} {copyText(" coin")}</Hand> : null}
    {notice ? <Hand style={{ fontSize: 25, textAlign: 'center' }}>{copyContent(c.unavailable)}</Hand> : null}
    <View style={{ alignSelf: 'stretch' }}><NotebookAction label={selected ? c.claim : c.spin} icon="play-circle-outline" onPress={onSpin} disabled={busy || spinning} /><NotebookAction label={c.later} icon="arrow-back" onPress={onDismiss} disabled={busy || spinning} /></View>
    {busy || spinning ? <ActivityIndicator color="#0879B7" style={{ marginTop: 15 }} /> : null}
  </NotebookPaper></NotebookLayer>;
  const content = (
    <View style={styles.backdrop}><View style={styles.card}>
      <Text style={styles.title}>{copyText("КОЛЕСО ФОРТУНЫ")}</Text>
      <Text style={styles.invitation}>{invitation[language]}</Text>
      <View style={styles.pointer} accessibilityLabel={copyText("Указатель колеса")}><View style={styles.pointerTip} /></View>
      <Animated.View style={[styles.wheel, { transform: [{ rotate: spin }] }]}>
        <Image source={require("../../assets/images/fortune-wheel-v2.png")} resizeMode="contain" style={styles.wheelArtwork} />
        {PRIZES.map((prize, index) => <View key={prize.label} pointerEvents="none" style={[styles.prizeBlock, { left: prizePositions[index].x - 40, top: prizePositions[index].y - 25 }]}>
          <Text style={styles.prize}>{copyContent(prize.label)}</Text><Text style={styles.prizeCaption}>{copyContent(prize.caption)}</Text>
        </View>)}
        <View style={styles.hub}><Image source={require("../../assets/brand/logo-mark.png")} resizeMode="contain" style={styles.hubImage} /></View>
      </Animated.View>
      {selected && !spinning ? <Text style={styles.selected}>{copyText("Выпало ")}{copyContent(selected)} {copyText(" coin")}</Text> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.copy}>{copyContent(notice)}</Text> : null}
      <Pressable disabled={busy || spinning} onPress={onSpin} style={[styles.spinButton, (busy || spinning) && styles.disabled]}>{busy || spinning ? <ActivityIndicator color="#082219" /> : <Text style={styles.spinText}>{copyContent(selected ? "РЕКЛАМА → ЗАБРАТЬ ПРИЗ" : "КРУТИТЬ КОЛЕСО")}</Text>}</Pressable>
      {!spinning && !busy ? <Pressable onPress={onDismiss} style={styles.dismiss}><Text style={styles.dismissText}>{copyText("Не сейчас")}</Text></Pressable> : null}
    </View></View>
  );
  // Keep the Android wheel in the game tree, not in a separate Dialog window
  // which can outlive dismissal when the ad activity returns and routes change.
  return Platform.OS === "android"
    ? <View accessibilityViewIsModal style={styles.androidLayer}>{content}</View>
    : <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busy && !spinning) onDismiss(); }}>{content}</Modal>;
}

const styles = StyleSheet.create({
  invitation: { color: "#B8CCBC", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
  androidLayer: { ...StyleSheet.absoluteFill, zIndex: 2000, elevation: 40 },
  backdrop: { flex: 1, backgroundColor: "rgba(16,37,27,0.88)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, alignItems: "center", padding: 26, borderRadius: 30, backgroundColor: "#182A21", borderWidth: 1, borderColor: "rgba(0,122,87,0.45)" },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", letterSpacing: 1 }, copy: { color: "#B8CCBC", fontSize: 13, textAlign: "center", marginTop: 7 },
  pointer: { zIndex: 3, width: 34, height: 30, alignItems: "center", justifyContent: "flex-start", marginTop: 17, marginBottom: -5 },
  pointerTip: { width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderTopWidth: 28, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#EF4444" },
  wheel: { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2, overflow: "hidden", marginTop: 0, marginBottom: 4, justifyContent: "center", alignItems: "center", shadowColor: "#007A57", shadowOpacity: 0.36, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  wheelArtwork: { width: WHEEL_SIZE, height: WHEEL_SIZE, position: "absolute" },
  prizeBlock: { position: "absolute", width: 80, height: 50, alignItems: "center", justifyContent: "center" },
  prize: { color: "#FFFFFF", fontSize: 19, lineHeight: 22, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
  prizeCaption: { color: "#FFF3BA", fontSize: 8, lineHeight: 11, fontWeight: "900", letterSpacing: 0.8, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  hub: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#10251B", borderWidth: 3, borderColor: "#FFF1B5", alignItems: "center", justifyContent: "center", overflow: "hidden", elevation: 4 }, hubImage: { width: 70, height: 70 },
  selected: { color: "#FFDC63", fontSize: 17, fontWeight: "900", marginBottom: 12 }, spinButton: { width: "100%", minHeight: 54, borderRadius: 17, backgroundColor: "#FFDC63", alignItems: "center", justifyContent: "center", marginTop: 12 }, spinText: { color: "#082219", fontSize: 12, fontWeight: "900", letterSpacing: 1 }, dismiss: { padding: 14 }, dismissText: { color: "#B8CCBC", fontSize: 13, fontWeight: "700" }, disabled: { opacity: 0.65 },
});
