import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

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

export function FortuneWheelModal({ visible, selected, spinning, busy, notice, onSpin, onSpinEnd, onDismiss }: {
  visible: boolean;
  selected: string | null;
  spinning: boolean;
  busy: boolean;
  notice?: string;
  onSpin: () => void;
  onSpinEnd: () => void;
  onDismiss: () => void;
}) {
  const [rotation] = useState(() => new Animated.Value(0));
  const onEnd = useRef(onSpinEnd);
  useEffect(() => { onEnd.current = onSpinEnd; }, [onSpinEnd]);
  const prizeIndex = Math.max(0, PRIZES.findIndex(prize => prize.label === selected));
  const finalAngle = 1440 + (360 - (prizeIndex * 72 + 36));
  const prizePositions = useMemo(() => PRIZES.map((_, index) => polar(index * 72 + 36, 88)), []);
  useEffect(() => {
    if (!spinning) return;
    rotation.setValue(0);
    const animation = Animated.timing(rotation, { toValue: 1, duration: 1500, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) onEnd.current(); });
    return () => animation.stop();
  }, [rotation, spinning]);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${finalAngle}deg`] });
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busy && !spinning) onDismiss(); }}>
    <View style={styles.backdrop}><View style={styles.card}>
      <Text style={styles.title}>КОЛЕСО ФОРТУНЫ</Text>
      <View style={styles.pointer} accessibilityLabel="Указатель колеса"><View style={styles.pointerTip} /></View>
      <Animated.View style={[styles.wheel, { transform: [{ rotate: spin }] }]}>
        <Image source={require("../../assets/images/fortune-wheel-v2.png")} resizeMode="contain" style={styles.wheelArtwork} />
        {PRIZES.map((prize, index) => <View key={prize.label} pointerEvents="none" style={[styles.prizeBlock, { left: prizePositions[index].x - 40, top: prizePositions[index].y - 25 }]}>
          <Text style={styles.prize}>{prize.label}</Text><Text style={styles.prizeCaption}>{prize.caption}</Text>
        </View>)}
        <View style={styles.hub}><Image source={require("../../assets/brand/logo-mark.png")} resizeMode="contain" style={styles.hubImage} /></View>
      </Animated.View>
      {selected && !spinning ? <Text style={styles.selected}>Выпало {selected} coin</Text> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.copy}>{notice}</Text> : null}
      <Pressable disabled={busy || spinning} onPress={onSpin} style={[styles.spinButton, (busy || spinning) && styles.disabled]}>{busy || spinning ? <ActivityIndicator color="#07101E" /> : <Text style={styles.spinText}>{selected ? "РЕКЛАМА → ЗАБРАТЬ ПРИЗ" : "КРУТИТЬ КОЛЕСО"}</Text>}</Pressable>
      {!spinning && !busy ? <Pressable onPress={onDismiss} style={styles.dismiss}><Text style={styles.dismissText}>Не сейчас</Text></Pressable> : null}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,5,14,0.88)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, alignItems: "center", padding: 26, borderRadius: 30, backgroundColor: "#111B35", borderWidth: 1, borderColor: "rgba(111,185,255,0.45)" },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", letterSpacing: 1 }, copy: { color: "#AEC1DF", fontSize: 13, textAlign: "center", marginTop: 7 },
  pointer: { zIndex: 3, width: 34, height: 30, alignItems: "center", justifyContent: "flex-start", marginTop: 17, marginBottom: -5 },
  pointerTip: { width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderTopWidth: 28, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#EF4444" },
  wheel: { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2, overflow: "hidden", marginTop: 0, marginBottom: 4, justifyContent: "center", alignItems: "center", shadowColor: "#3784FF", shadowOpacity: 0.36, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  wheelArtwork: { width: WHEEL_SIZE, height: WHEEL_SIZE, position: "absolute" },
  prizeBlock: { position: "absolute", width: 80, height: 50, alignItems: "center", justifyContent: "center" },
  prize: { color: "#FFFFFF", fontSize: 19, lineHeight: 22, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
  prizeCaption: { color: "#FFF3BA", fontSize: 8, lineHeight: 11, fontWeight: "900", letterSpacing: 0.8, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  hub: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#0A1738", borderWidth: 3, borderColor: "#FFF1B5", alignItems: "center", justifyContent: "center", overflow: "hidden", elevation: 4 }, hubImage: { width: 70, height: 70 },
  selected: { color: "#FFDC63", fontSize: 17, fontWeight: "900", marginBottom: 12 }, spinButton: { width: "100%", minHeight: 54, borderRadius: 17, backgroundColor: "#FFDC63", alignItems: "center", justifyContent: "center", marginTop: 12 }, spinText: { color: "#07101E", fontSize: 12, fontWeight: "900", letterSpacing: 1 }, dismiss: { padding: 14 }, dismissText: { color: "#A9B9D2", fontSize: 13, fontWeight: "700" }, disabled: { opacity: 0.65 },
});
