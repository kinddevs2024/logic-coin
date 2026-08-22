/* eslint-disable react-hooks/immutability -- Reanimated shared values are intentionally mutable inside worklets. */
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageBackground, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeInDown, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/app-text";
import { GameEconomyHud, GameEconomyModal } from "@/components/game-economy";
import { cosmeticFor } from "@/games/cosmetics";
import { applyPuzzleEvent, createPuzzleState, nextHint, pointInsideObject, updatePuzzlePosition } from "@/games/brain-tricks/engine";
import { BRAIN_TRICKS_LEVELS, getBrainTricksLevel } from "@/games/brain-tricks/levels";
import type { PuzzleObjectDefinition, PuzzlePoint, PuzzleRuntimeState } from "@/games/brain-tricks/types";
import { gameProgressFor, useGameProgressStore } from "@/games/progress-store";
import { useClientReady } from "@/hooks/use-client-ready";

const PAPER = require("../../../assets/games/brain-paper.png");
const LIME = "#B9F14A";
const INK = "#2D2A25";

function fallbackIcon(id: string): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  if (id.includes("cloud")) return "weather-cloudy";
  if (id.includes("sun")) return "weather-sunny";
  if (id.includes("star") || id.includes("reward")) return "star-four-points";
  if (id.includes("key") || id.includes("part")) return "key-variant";
  if (id.includes("door") || id.includes("fridge")) return "fridge-outline";
  if (id.includes("robot") || id.includes("machine")) return "robot";
  if (id.includes("fruit")) return "food-apple";
  if (id.includes("switch")) return "toggle-switch";
  return "shape";
}

function PuzzleObjectSprite({
  object,
  position,
  objectState,
  sceneWidth,
  sceneHeight,
  visible,
  onTap,
  onDrop,
}: {
  object: PuzzleObjectDefinition;
  position: PuzzlePoint;
  objectState: string;
  sceneWidth: number;
  sceneHeight: number;
  visible: boolean;
  onTap: (id: string) => void;
  onDrop: (id: string, point: PuzzlePoint) => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const wobble = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { rotate: `${wobble.value}deg` }] }));
  const tap = useMemo(() => Gesture.Tap().enabled(Boolean(object.tappable)).onEnd(() => {
    "worklet";
    wobble.value = withSequence(withTiming(-5, { duration: 60 }), withTiming(5, { duration: 80 }), withTiming(0, { duration: 60 }));
    runOnJS(onTap)(object.id);
  }), [object.id, object.tappable, onTap, wobble]);
  const pan = useMemo(() => Gesture.Pan().enabled(Boolean(object.draggable)).minDistance(3).onUpdate((event) => {
    "worklet";
    translateX.value = event.translationX;
    translateY.value = event.translationY;
  }).onEnd((event) => {
    "worklet";
    const point = { x: position.x + (event.translationX / sceneWidth) * 100, y: position.y + (event.translationY / sceneHeight) * 100 };
    translateX.value = withTiming(0, { duration: 100 });
    translateY.value = withTiming(0, { duration: 100 });
    runOnJS(onDrop)(object.id, point);
  }), [object.draggable, object.id, onDrop, position.x, position.y, sceneHeight, sceneWidth, translateX, translateY]);

  if (!visible || object.isZone) return null;
  const pixels = Math.max(48, (object.size / 100) * Math.min(sceneWidth, sceneHeight) * 1.7);
  const icon = (object.icon as React.ComponentProps<typeof MaterialCommunityIcons>["name"] | undefined) ?? fallbackIcon(object.id);
  const color = object.color?.startsWith("#") ? object.color : objectState === "solved" || objectState === "awake" ? "#54B94A" : "#6E665A";

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View accessible={Boolean(object.tappable || object.draggable)} accessibilityRole={object.tappable || object.draggable ? "button" : undefined} accessibilityLabel={object.label ?? object.id} style={[styles.puzzleObject, { left: (position.x / 100) * sceneWidth - pixels / 2, top: (position.y / 100) * sceneHeight - pixels / 2, width: pixels, height: pixels, zIndex: object.layer === "FOREGROUND" ? 12 : object.layer === "CHARACTER" ? 8 : 5 }, animatedStyle]}>
        <MaterialCommunityIcons name={icon} size={Math.max(33, pixels * 0.75)} color={color} />
      </Animated.View>
    </GestureDetector>
  );
}

function PaperIconButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.paperButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={INK} />
    </Pressable>
  );
}

export default function BrainTricksScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const ready = useClientReady();
  const saved = useGameProgressStore((state) => gameProgressFor(state.games, "brain-tricks"));
  const progress = ready ? saved : gameProgressFor({}, "brain-tricks");
  const hydrated = useGameProgressStore((state) => state.hydrated);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);
  const setCurrentLevel = useGameProgressStore((state) => state.setCurrentLevel);
  const [levelId, setLevelId] = useState(() => Math.min(progress.currentLevel, BRAIN_TRICKS_LEVELS.length));
  const level = useMemo(() => getBrainTricksLevel(levelId), [levelId]);
  const [puzzle, setPuzzle] = useState<PuzzleRuntimeState>(() => createPuzzleState(level));
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [answer, setAnswer] = useState(0);
  const [intro, setIntro] = useState(true);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [economyOpen, setEconomyOpen] = useState(false);
  const completedRef = useRef(false);
  const hydrationApplied = useRef(false);
  const mascot = cosmeticFor("brain-tricks", progress.selectedCosmetic);

  const sceneWidth = Math.max(300, Math.min(width - 22, 780));
  const sceneHeight = Math.max(410, Math.min(height - 104, sceneWidth * 1.12, 670));

  const reset = useCallback((next = level) => {
    setPuzzle(createPuzzleState(next));
    setHintsUsed(0);
    setHintText(null);
    setAnswer(0);
    completedRef.current = false;
  }, [level]);

  useEffect(() => {
    if (!hydrated || hydrationApplied.current) return;
    hydrationApplied.current = true;
    const nextId = Math.min(progress.currentLevel, BRAIN_TRICKS_LEVELS.length);
    if (nextId === levelId) return;
    const timer = setTimeout(() => {
      const next = getBrainTricksLevel(nextId);
      setLevelId(nextId);
      reset(next);
    }, 0);
    return () => clearTimeout(timer);
  }, [hydrated, levelId, progress.currentLevel, reset]);

  useEffect(() => {
    if (!puzzle.completed || completedRef.current) return;
    completedRef.current = true;
    completeLevel("brain-tricks", level.id, { hints: hintsUsed, score: Math.max(100, 1200 - hintsUsed * 160), result: `Задача ${level.id}` });
  }, [completeLevel, hintsUsed, level.id, puzzle.completed]);

  const chooseLevel = useCallback((id: number) => {
    if (id > progress.highestUnlockedLevel) return;
    const next = getBrainTricksLevel(id);
    setLevelId(id);
    setCurrentLevel("brain-tricks", id);
    reset(next);
    setIntro(false);
    setLevelsOpen(false);
  }, [progress.highestUnlockedLevel, reset, setCurrentLevel]);

  const tapObject = useCallback((objectId: string) => {
    setPuzzle((state) => applyPuzzleEvent(level, state, { type: "tap", actorId: objectId }));
  }, [level]);

  const dropObject = useCallback((objectId: string, point: PuzzlePoint) => {
    setPuzzle((state) => {
      const target = level.objects.find((item) => item.id !== objectId && item.isZone && state.visibility[item.id] && pointInsideObject(point, state.positions[item.id]!, item.size));
      if (!target) return { ...state, wrongActions: state.wrongActions + 1 };
      const moved = updatePuzzlePosition(state, objectId, point);
      return applyPuzzleEvent(level, moved, { type: "drop", actorId: objectId, targetId: target.id });
    });
  }, [level]);

  const showHint = () => {
    setHintText(nextHint(level, hintsUsed));
    setHintsUsed((value) => Math.min(3, value + 1));
  };

  const submitPizza = () => {
    if (answer === 8) setPuzzle((state) => ({ ...state, completed: true }));
    else setPuzzle((state) => ({ ...state, wrongActions: state.wrongActions + 1 }));
  };

  return (
    <ImageBackground source={PAPER} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.topBar}>
          <PaperIconButton icon="home-outline" label="Выйти из игры" onPress={() => router.back()} />
          <Pressable accessibilityRole="button" accessibilityLabel="Выбрать уровень" onPress={() => setLevelsOpen(true)} style={styles.levelPill}>
            <AppText style={styles.levelPillText}>Level {level.id}</AppText>
          </Pressable>
          <View style={styles.topRight}>
            <PaperIconButton icon="bulb-outline" label="Подсказка" onPress={showHint} />
            <GameEconomyHud gameId="brain-tricks" onOpen={() => setEconomyOpen(true)} />
          </View>
        </View>

        <View style={styles.sceneWrap}>
          <View style={[styles.scene, { width: sceneWidth, height: sceneHeight }]}>
            {intro ? (
              <Animated.View entering={FadeIn.duration(220)} style={styles.intro}>
                <MaterialCommunityIcons name={mascot.icon} size={68} color={mascot.primary} />
                <AppText style={styles.introTitle}>ARE YOU READY TO{`\n`}TEST YOUR BRAIN?</AppText>
                <Pressable accessibilityRole="button" accessibilityLabel="Начать" onPress={() => setIntro(false)} style={styles.readyButton}>
                  <AppText style={styles.readyText}>READY</AppText>
                </Pressable>
              </Animated.View>
            ) : (
              <>
                <AppText style={styles.question}>{level.instruction}</AppText>
                {level.objects.map((item) => (
                  <PuzzleObjectSprite key={item.id} object={item} position={puzzle.positions[item.id]!} objectState={puzzle.objectStates[item.id] ?? "idle"} visible={puzzle.visibility[item.id]} sceneWidth={sceneWidth} sceneHeight={sceneHeight} onTap={tapObject} onDrop={dropObject} />
                ))}

                {level.id === 5 && !puzzle.completed ? (
                  <View style={styles.answerRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Уменьшить" onPress={() => setAnswer((value) => Math.max(0, value - 1))} style={styles.answerButton}><Ionicons name="remove" size={24} color={INK} /></Pressable>
                    <AppText style={styles.answerValue}>{answer}</AppText>
                    <Pressable accessibilityRole="button" accessibilityLabel="Увеличить" onPress={() => setAnswer((value) => Math.min(20, value + 1))} style={styles.answerButton}><Ionicons name="add" size={24} color={INK} /></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Ответить" onPress={submitPizza} style={styles.submitButton}><AppText style={styles.submitText}>SUBMIT</AppText></Pressable>
                  </View>
                ) : null}

                {hintText && !puzzle.completed ? <Animated.View entering={FadeInDown.duration(160)} style={styles.hintBubble}><AppText style={styles.hintText}>{hintText}</AppText></Animated.View> : null}

                {puzzle.completed ? (
                  <Animated.View entering={FadeIn.duration(220)} style={styles.completeOverlay}>
                    <MaterialCommunityIcons name="party-popper" size={62} color="#1688F2" />
                    <AppText style={styles.completeTitle}>{level.successText ?? "GREAT JOB!"}</AppText>
                    <AppText style={styles.coinReward}>+{25 + Math.min(25, level.id)} coin</AppText>
                    <Pressable accessibilityRole="button" accessibilityLabel="Следующий уровень" onPress={() => level.id < BRAIN_TRICKS_LEVELS.length ? chooseLevel(level.id + 1) : setLevelsOpen(true)} style={styles.readyButton}>
                      <AppText style={styles.readyText}>NEXT</AppText>
                    </Pressable>
                  </Animated.View>
                ) : null}
              </>
            )}
          </View>
        </View>

        <Modal transparent visible={levelsOpen} animationType="fade" onRequestClose={() => setLevelsOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.levelPanel}>
              <View style={styles.panelTop}>
                <AppText style={styles.panelTitle}>Levels</AppText>
                <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => setLevelsOpen(false)} style={styles.paperButton}><Ionicons name="close" size={22} color={INK} /></Pressable>
              </View>
              <View style={styles.levelGrid}>
                {BRAIN_TRICKS_LEVELS.map((item) => {
                  const locked = item.id > progress.highestUnlockedLevel;
                  const done = progress.completedLevels.includes(item.id);
                  return <Pressable key={item.id} disabled={locked} onPress={() => chooseLevel(item.id)} style={[styles.levelCell, done && styles.levelDone, item.id === level.id && styles.levelCurrent, locked && styles.levelLocked]}><AppText style={styles.levelNumber}>{item.id}</AppText></Pressable>;
                })}
              </View>
            </View>
          </View>
        </Modal>

        <GameEconomyModal gameId="brain-tricks" visible={economyOpen} onClose={() => setEconomyOpen(false)} />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#D39B58" },
  backgroundImage: { width: "100%", height: "100%", opacity: 0.98 },
  safe: { flex: 1 },
  topBar: { minHeight: 62, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 30 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  paperButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,253,246,0.88)", borderWidth: 2, borderColor: "rgba(62,54,43,0.24)", alignItems: "center", justifyContent: "center", shadowColor: "#4E3B27", shadowOpacity: 0.16, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  levelPill: { minHeight: 38, borderRadius: 13, paddingHorizontal: 15, backgroundColor: "rgba(255,253,246,0.88)", borderWidth: 2, borderColor: "rgba(62,54,43,0.2)", alignItems: "center", justifyContent: "center" },
  levelPillText: { color: INK, fontSize: 12, lineHeight: 15, fontWeight: "900" },
  sceneWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 8 },
  scene: { position: "relative", overflow: "hidden" },
  question: { position: "absolute", top: 18, left: 24, right: 24, color: INK, fontSize: 24, lineHeight: 30, fontWeight: "900", textAlign: "center", zIndex: 20 },
  puzzleObject: { position: "absolute", alignItems: "center", justifyContent: "center" },
  intro: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 24, padding: 24 },
  introTitle: { width: "100%", color: INK, fontSize: 27, lineHeight: 35, fontWeight: "900", textAlign: "center" },
  readyButton: { minWidth: 146, minHeight: 56, borderRadius: 16, paddingHorizontal: 28, backgroundColor: LIME, borderWidth: 3, borderColor: INK, alignItems: "center", justifyContent: "center", shadowColor: INK, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0 },
  readyText: { color: INK, fontSize: 18, lineHeight: 22, fontWeight: "900", letterSpacing: 1 },
  hintBubble: { position: "absolute", left: 24, right: 24, bottom: 18, borderRadius: 14, padding: 12, backgroundColor: "rgba(255,253,246,0.94)", borderWidth: 2, borderColor: "rgba(45,42,37,0.18)", zIndex: 28 },
  hintText: { color: INK, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" },
  answerRow: { position: "absolute", left: 0, right: 0, bottom: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 24 },
  answerButton: { width: 43, height: 43, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" },
  answerValue: { minWidth: 40, color: INK, fontSize: 22, lineHeight: 27, fontWeight: "900", textAlign: "center" },
  submitButton: { minHeight: 43, borderRadius: 13, paddingHorizontal: 18, backgroundColor: LIME, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" },
  submitText: { color: INK, fontSize: 12, lineHeight: 15, fontWeight: "900" },
  completeOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 16, padding: 24, backgroundColor: "rgba(255,251,239,0.94)", zIndex: 40 },
  completeTitle: { color: INK, fontSize: 24, lineHeight: 31, fontWeight: "900", textAlign: "center" },
  coinReward: { color: "#B77F00", fontSize: 16, lineHeight: 20, fontWeight: "900" },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(66,44,23,0.48)" },
  levelPanel: { width: "100%", maxWidth: 600, maxHeight: "90%", borderRadius: 20, padding: 16, backgroundColor: "#FFF9E9", borderWidth: 3, borderColor: INK, gap: 14 },
  panelTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTitle: { color: INK, fontSize: 30, lineHeight: 37, fontWeight: "900" },
  levelGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  levelCell: { width: 47, height: 47, borderRadius: 12, borderWidth: 2, borderColor: INK, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  levelDone: { backgroundColor: LIME },
  levelCurrent: { backgroundColor: "#56BDF4" },
  levelLocked: { opacity: 0.34 },
  levelNumber: { color: INK, fontSize: 13, lineHeight: 16, fontWeight: "900" },
  pressed: { transform: [{ scale: 0.95 }] },
});
