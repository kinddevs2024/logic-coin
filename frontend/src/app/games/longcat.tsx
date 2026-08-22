import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, runOnJS } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/app-text";
import { GameEconomyHud, GameEconomyModal } from "@/components/game-economy";
import { cosmeticFor } from "@/games/cosmetics";
import {
  createLongcatState,
  isLongcatComplete,
  isLongcatStuck,
  pointKey,
  traceLongcatMove,
} from "@/games/longcat/engine";
import { getLongcatLevel, LONGCAT_LEVELS } from "@/games/longcat/levels";
import { solveLongcatLevel } from "@/games/longcat/solver";
import type { LongcatDirection, LongcatState } from "@/games/longcat/types";
import { gameProgressFor, useGameProgressStore } from "@/games/progress-store";
import { useClientReady } from "@/hooks/use-client-ready";

const PEACH = "#FFB98F";
const TRENCH = "#B7352A";
const TRENCH_DARK = "#8F2B23";
const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function directionFromGesture(x: number, y: number): LongcatDirection {
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "RIGHT" : "LEFT";
  return y > 0 ? "DOWN" : "UP";
}

function IconButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={24} color="#424556" />
    </Pressable>
  );
}

export default function LongcatScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const ready = useClientReady();
  const saved = useGameProgressStore((state) => gameProgressFor(state.games, "longcat"));
  const progress = ready ? saved : gameProgressFor({}, "longcat");
  const hydrated = useGameProgressStore((state) => state.hydrated);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);
  const setCurrentLevel = useGameProgressStore((state) => state.setCurrentLevel);
  const [levelId, setLevelId] = useState(() => Math.min(progress.currentLevel, LONGCAT_LEVELS.length));
  const level = useMemo(() => getLongcatLevel(levelId), [levelId]);
  const [game, setGame] = useState<LongcatState>(() => createLongcatState(level));
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState<"PLAYING" | "MOVING" | "COMPLETE" | "FAILED">("PLAYING");
  const [menuOpen, setMenuOpen] = useState(false);
  const [economyOpen, setEconomyOpen] = useState(false);
  const [hint, setHint] = useState<LongcatDirection | null>(null);
  const hydrationApplied = useRef(false);

  const skin = cosmeticFor("longcat", progress.selectedCosmetic);

  const reset = useCallback((nextLevel = level) => {
    setGame(createLongcatState(nextLevel));
    setMoves(0);
    setHint(null);
    setStatus("PLAYING");
  }, [level]);

  useEffect(() => {
    if (!hydrated || hydrationApplied.current) return;
    hydrationApplied.current = true;
    const nextId = Math.min(progress.currentLevel, LONGCAT_LEVELS.length);
    if (nextId === levelId) return;
    const timer = setTimeout(() => {
      const next = getLongcatLevel(nextId);
      setLevelId(nextId);
      reset(next);
    }, 0);
    return () => clearTimeout(timer);
  }, [hydrated, levelId, progress.currentLevel, reset]);

  const chooseLevel = useCallback((id: number) => {
    if (id > progress.highestUnlockedLevel) return;
    const next = getLongcatLevel(id);
    setLevelId(id);
    setCurrentLevel("longcat", id);
    reset(next);
    setMenuOpen(false);
  }, [progress.highestUnlockedLevel, reset, setCurrentLevel]);

  const finish = useCallback((next: LongcatState, nextMoves: number) => {
    if (isLongcatComplete(level, next)) {
      completeLevel("longcat", level.id, {
        moves: nextMoves,
        score: Math.max(100, level.grid.length * 120 - nextMoves * 10),
        result: `Уровень ${level.id}`,
      });
      setStatus("COMPLETE");
    } else if (isLongcatStuck(level, next)) {
      setStatus("FAILED");
    } else {
      setStatus("PLAYING");
    }
  }, [completeLevel, level]);

  const move = useCallback(async (direction: LongcatDirection) => {
    if (status !== "PLAYING") return;
    const path = traceLongcatMove(level, game, direction);
    if (!path.length) return;
    setStatus("MOVING");
    let animated = game;
    for (const point of path) {
      animated = { head: point, body: [...animated.body, point] };
      setGame(animated);
      await wait(42);
    }
    const nextMoves = moves + 1;
    setMoves(nextMoves);
    setHint(null);
    finish(animated, nextMoves);
  }, [finish, game, level, moves, status]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = ({ ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT", w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT" } as Record<string, LongcatDirection | undefined>)[event.key];
      if (!direction) return;
      event.preventDefault();
      void move(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  const gesture = useMemo(() => Gesture.Pan().minDistance(16).onEnd((event) => {
    "worklet";
    runOnJS(move)(directionFromGesture(event.translationX, event.translationY));
  }), [move]);

  const showHint = () => {
    const solution = solveLongcatLevel(level).solution;
    setHint(solution[Math.min(moves, solution.length - 1)] ?? solution[0] ?? null);
  };

  const nextLevel = () => {
    if (level.id >= LONGCAT_LEVELS.length) {
      setMenuOpen(true);
      return;
    }
    chooseLevel(level.id + 1);
  };

  const rows = level.grid.length;
  const columns = Math.max(...level.grid.map((row) => row.length));
  const limit = Math.max(260, Math.min(width - 28, height - 122, 650));
  const cell = Math.max(22, Math.floor(limit / Math.max(rows, columns)));
  const occupied = useMemo(() => new Set(game.body.map(pointKey)), [game.body]);
  const directionIcon = ({ UP: "arrow-up", DOWN: "arrow-down", LEFT: "arrow-back", RIGHT: "arrow-forward" } as const)[hint ?? "RIGHT"];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.topBar}>
        <IconButton icon="pause" label="Уровни" onPress={() => setMenuOpen(true)} />
        <View style={styles.topActions}>
          <GameEconomyHud gameId="longcat" onOpen={() => setEconomyOpen(true)} />
          <IconButton icon="bulb-outline" label="Подсказка" onPress={showHint} />
          <IconButton icon="refresh" label="Начать заново" onPress={() => reset()} />
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={styles.stage}>
          <View style={{ width: columns * cell, height: rows * cell }}>
            {level.grid.map((row, rowIndex) => row.map((value, colIndex) => {
              const key = `${rowIndex}:${colIndex}`;
              if (value !== 1) return null;
              const has = (r: number, c: number) => level.grid[r]?.[c] === 1;
              const head = game.head.row === rowIndex && game.head.col === colIndex;
              const filled = occupied.has(key);
              return (
                <View key={key} style={[styles.pathCell, {
                  left: colIndex * cell,
                  top: rowIndex * cell,
                  width: cell,
                  height: cell,
                  borderTopWidth: has(rowIndex - 1, colIndex) ? 0 : 4,
                  borderBottomWidth: has(rowIndex + 1, colIndex) ? 0 : 4,
                  borderLeftWidth: has(rowIndex, colIndex - 1) ? 0 : 4,
                  borderRightWidth: has(rowIndex, colIndex + 1) ? 0 : 4,
                }]}>
                  {filled ? (
                    <View style={[styles.catFill, { backgroundColor: skin.primary }, head && styles.catHead]}>
                      {head ? <MaterialCommunityIcons name="cat" color={skin.id === "panda" ? "#FFFFFF" : "#373044"} size={Math.max(17, cell * 0.62)} /> : null}
                    </View>
                  ) : null}
                </View>
              );
            }))}

            {hint && status === "PLAYING" ? (
              <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} style={styles.hintBadge}>
                <Ionicons name={directionIcon} size={28} color="#424556" />
              </Animated.View>
            ) : null}

            {status === "COMPLETE" || status === "FAILED" ? (
              <Animated.View entering={FadeIn.duration(180)} style={styles.resultOverlay}>
                <MaterialCommunityIcons name={status === "COMPLETE" ? "party-popper" : "refresh"} size={54} color={status === "COMPLETE" ? "#078CF0" : "#424556"} />
                {status === "COMPLETE" ? <AppText style={styles.rewardText}>+{25 + Math.min(25, level.id)} coin</AppText> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={status === "COMPLETE" ? "Следующий уровень" : "Повторить"} onPress={status === "COMPLETE" ? nextLevel : () => reset()} style={styles.resultButton}>
                  <Ionicons name={status === "COMPLETE" ? "play" : "refresh"} size={27} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </GestureDetector>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.levelPanel}>
            <View style={styles.levelPanelTop}>
              <Pressable accessibilityRole="button" accessibilityLabel="Назад в приложение" onPress={() => router.back()} style={styles.smallSquare}>
                <Ionicons name="chevron-back" size={25} color="#424556" />
              </Pressable>
              <AppText style={styles.levelTitle}>Levels</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => setMenuOpen(false)} style={styles.smallSquare}>
                <Ionicons name="close" size={24} color="#424556" />
              </Pressable>
            </View>
            <View style={styles.levelGrid}>
              {LONGCAT_LEVELS.map((item) => {
                const locked = item.id > progress.highestUnlockedLevel;
                const done = progress.completedLevels.includes(item.id);
                return (
                  <Pressable key={item.id} disabled={locked} onPress={() => chooseLevel(item.id)} style={[styles.levelButton, done && styles.levelDone, item.id === level.id && styles.levelCurrent, locked && styles.levelLocked]}>
                    <AppText style={styles.levelNumber}>{item.id}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Продолжить" onPress={() => setMenuOpen(false)} style={styles.resumeButton}>
              <Ionicons name="play" size={30} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Modal>

      <GameEconomyModal gameId="longcat" visible={economyOpen} onClose={() => setEconomyOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PEACH },
  topBar: { minHeight: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 10 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconButton: { width: 46, height: 46, borderRadius: 15, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#F3F4F8", alignItems: "center", justifyContent: "center", shadowColor: "#413D4B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.7, shadowRadius: 0 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingBottom: 12 },
  pathCell: { position: "absolute", backgroundColor: TRENCH, borderColor: "#FFF9F3", shadowColor: TRENCH_DARK, shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.45, shadowRadius: 0, padding: 2 },
  catFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  catHead: { zIndex: 3 },
  hintBadge: { position: "absolute", left: "50%", top: "50%", width: 56, height: 56, marginLeft: -28, marginTop: -28, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  resultOverlay: { position: "absolute", left: -16, top: -16, right: -16, bottom: -16, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "rgba(255,185,143,0.86)", zIndex: 20 },
  rewardText: { color: "#323443", fontSize: 18, lineHeight: 23, fontWeight: "900" },
  resultButton: { width: 68, height: 58, borderRadius: 17, backgroundColor: "#078CF0", borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#123A6A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.75, shadowRadius: 0 },
  menuBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 18, backgroundColor: "rgba(205,101,70,0.46)" },
  levelPanel: { width: "100%", maxWidth: 540, maxHeight: "92%", borderRadius: 28, padding: 18, backgroundColor: PEACH, borderWidth: 4, borderColor: "#FFFFFF", gap: 18 },
  levelPanelTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  smallSquare: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#F3F4F8", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  levelTitle: { color: "#0C0D12", fontSize: 36, lineHeight: 42, fontWeight: "900", textShadowColor: "#FFFFFF", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  levelGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  levelButton: { width: 64, height: 64, borderRadius: 15, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#66687B", alignItems: "center", justifyContent: "center", shadowColor: "#222431", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0 },
  levelDone: { backgroundColor: "#35C34A" },
  levelCurrent: { backgroundColor: "#078CF0" },
  levelLocked: { opacity: 0.62 },
  levelNumber: { color: "#FFFFFF", fontSize: 20, lineHeight: 25, fontWeight: "900" },
  resumeButton: { minHeight: 62, borderRadius: 17, backgroundColor: "#078CF0", borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#123A6A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.8, shadowRadius: 0 },
  pressed: { transform: [{ scale: 0.95 }] },
});
