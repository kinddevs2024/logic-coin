import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { AppText } from "@/components/app-text";
import { GameEconomyHud, GameEconomyModal } from "@/components/game-economy";
import { isBoardSolved, rotateTile } from "@/games/loops/engine";
import { getLoopLevel, LOOP_LEVELS } from "@/games/loops/levels";
import { getHint } from "@/games/loops/solver";
import { LOOP_THEMES } from "@/games/loops/themes";
import { EAST, NORTH, SOUTH, WEST, type LoopBoard, type LoopTile as LoopTileType } from "@/games/loops/types";
import { gameProgressFor, useGameProgressStore } from "@/games/progress-store";
import { useClientReady } from "@/hooks/use-client-ready";

const COMPLETE_BACKGROUNDS: Record<string, string> = {
  minimal: "#2F080D",
  neon: "#07131E",
  ocean: "#0A291B",
  galaxy: "#100823",
};

function cornerPath(mask: number, size: number) {
  const center = size / 2;
  if (mask === (NORTH | EAST)) return `M ${center} -2 Q ${center} ${center} ${size + 2} ${center}`;
  if (mask === (EAST | SOUTH)) return `M ${size + 2} ${center} Q ${center} ${center} ${center} ${size + 2}`;
  if (mask === (SOUTH | WEST)) return `M ${center} ${size + 2} Q ${center} ${center} -2 ${center}`;
  if (mask === (WEST | NORTH)) return `M -2 ${center} Q ${center} ${center} ${center} -2`;
  return null;
}

function LoopTile({ tile, size, color, hinted, onPress }: { tile: LoopTileType; size: number; color: string; hinted: boolean; onPress: () => void }) {
  const rotation = useSharedValue(tile.rotation * 90);
  useEffect(() => { rotation.value = withTiming(tile.rotation * 90, { duration: 150 }); }, [rotation, tile.rotation]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const center = size / 2;
  const stroke = Math.max(4, size * 0.085);
  const curve = cornerPath(tile.baseMask, size);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Повернуть линию" onPress={onPress} style={[styles.tile, { width: size, height: size }, hinted && styles.hinted]}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <Svg width={size} height={size}>
          {curve ? <Path d={curve} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : (
            <>
              {tile.baseMask & NORTH ? <Line x1={center} y1={center} x2={center} y2={-2} stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
              {tile.baseMask & EAST ? <Line x1={center} y1={center} x2={size + 2} y2={center} stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
              {tile.baseMask & SOUTH ? <Line x1={center} y1={center} x2={center} y2={size + 2} stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
              {tile.baseMask & WEST ? <Line x1={center} y1={center} x2={-2} y2={center} stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
              <Circle cx={center} cy={center} r={stroke / 2} fill={color} />
            </>
          )}
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

function TinyButton({ icon, label, color, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; color: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tinyButton, pressed && styles.pressed]}><Ionicons name={icon} size={19} color={color} /></Pressable>;
}

export default function LoopsScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const ready = useClientReady();
  const saved = useGameProgressStore((state) => gameProgressFor(state.games, "loops"));
  const progress = ready ? saved : gameProgressFor({}, "loops");
  const hydrated = useGameProgressStore((state) => state.hydrated);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);
  const setCurrentLevel = useGameProgressStore((state) => state.setCurrentLevel);
  const [levelId, setLevelId] = useState(() => Math.min(progress.currentLevel, LOOP_LEVELS.length));
  const level = useMemo(() => getLoopLevel(levelId), [levelId]);
  const makeBoard = useCallback((id: number): LoopBoard => {
    const next = getLoopLevel(id);
    return { rows: next.rows, cols: next.cols, tiles: next.tiles.map((tile) => ({ ...tile })), requireSingleNetwork: next.requireSingleNetwork };
  }, []);
  const [board, setBoard] = useState<LoopBoard>(() => makeBoard(levelId));
  const [rotations, setRotations] = useState(0);
  const [status, setStatus] = useState<"PLAYING" | "COMPLETE">("PLAYING");
  const [hintedIndex, setHintedIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [economyOpen, setEconomyOpen] = useState(false);
  const hydrationApplied = useRef(false);
  const theme = LOOP_THEMES.find((item) => item.id === progress.selectedCosmetic) ?? LOOP_THEMES[0]!;
  const background = status === "COMPLETE" ? COMPLETE_BACKGROUNDS[theme.id] ?? "#241014" : theme.background;
  const line = status === "COMPLETE" ? theme.glow : theme.line;

  const reset = useCallback((id = levelId) => {
    setBoard(makeBoard(id));
    setRotations(0);
    setStatus("PLAYING");
    setHintedIndex(null);
  }, [levelId, makeBoard]);

  useEffect(() => {
    if (!hydrated || hydrationApplied.current) return;
    hydrationApplied.current = true;
    const nextId = Math.min(progress.currentLevel, LOOP_LEVELS.length);
    if (nextId === levelId) return;
    const timer = setTimeout(() => {
      setLevelId(nextId);
      reset(nextId);
    }, 0);
    return () => clearTimeout(timer);
  }, [hydrated, levelId, progress.currentLevel, reset]);

  const chooseLevel = useCallback((id: number) => {
    if (id > progress.highestUnlockedLevel) return;
    setLevelId(id);
    setCurrentLevel("loops", id);
    reset(id);
    setMenuOpen(false);
  }, [progress.highestUnlockedLevel, reset, setCurrentLevel]);

  const rotate = (index: number) => {
    if (status !== "PLAYING") return;
    const next = rotateTile(board, index);
    const nextRotations = rotations + 1;
    setBoard(next);
    setRotations(nextRotations);
    setHintedIndex(null);
    setTimeout(() => {
      if (!isBoardSolved(next)) return;
      completeLevel("loops", level.id, { moves: nextRotations, score: Math.max(100, 3000 - nextRotations * 20), result: `Уровень ${level.id}` });
      setStatus("COMPLETE");
    }, 170);
  };

  const showHint = () => {
    const result = getHint(board);
    if (!result) return;
    setHintedIndex(result.index);
    setTimeout(() => setHintedIndex((current) => current === result.index ? null : current), 1800);
  };

  const next = () => {
    if (level.id < LOOP_LEVELS.length) chooseLevel(level.id + 1);
    else setMenuOpen(true);
  };

  const boardLimit = Math.max(260, Math.min(width - 44, height - 175, 620));
  const tileSize = Math.floor(boardLimit / Math.max(level.rows, level.cols));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.topBar}>
        <TinyButton icon="chevron-back" label="Назад" color={line} onPress={() => router.back()} />
        <GameEconomyHud gameId="loops" tone={status === "COMPLETE" ? "light" : "dark"} onOpen={() => setEconomyOpen(true)} />
      </View>

      <Pressable accessibilityRole={status === "COMPLETE" ? "button" : undefined} accessibilityLabel={status === "COMPLETE" ? "Следующий уровень" : undefined} onPress={status === "COMPLETE" ? next : undefined} style={styles.main}>
        <View style={styles.copyArea}>
          {status === "COMPLETE" ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.successCopy}>
              <AppText style={[styles.successNumber, { color: line }]}>#{level.id}</AppText>
              <AppText style={[styles.successText, { color: line }]}>{level.id === 1 ? "Well done\nThe goal is to create closed shapes\nTap anywhere to proceed" : "Great. You nailed it\nTap anywhere to proceed"}</AppText>
              <AppText style={[styles.successCoin, { color: line }]}>+{25 + Math.min(25, level.id)} coin</AppText>
            </Animated.View>
          ) : level.id === 1 && rotations === 0 ? (
            <AppText style={[styles.instruction, { color: line }]}>Tap the pieces to rotate,{`\n`}and create the infinity symbol</AppText>
          ) : (
            <AppText style={[styles.levelNumber, { color: line }]}>#{level.id}</AppText>
          )}
        </View>

        <View style={[styles.board, { width: tileSize * level.cols, height: tileSize * level.rows }]}>
          {board.tiles.map((tile, index) => <LoopTile key={index} tile={tile} size={tileSize} color={line} hinted={hintedIndex === index} onPress={() => rotate(index)} />)}
        </View>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel="Меню игры" onPress={() => setMenuOpen(true)} style={styles.dotMenu}>
        {[0, 1, 2, 3].map((dot) => <View key={dot} style={[styles.dot, { backgroundColor: line }]} />)}
      </Pressable>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.menuPanel, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.menuTop}>
              <AppText style={[styles.menuTitle, { color: theme.line }]}>Levels</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => setMenuOpen(false)} style={styles.menuClose}><Ionicons name="close" size={22} color={theme.line} /></Pressable>
            </View>
            <View style={styles.levelGrid}>
              {LOOP_LEVELS.map((item) => {
                const locked = item.id > progress.highestUnlockedLevel;
                const done = progress.completedLevels.includes(item.id);
                return <Pressable key={item.id} disabled={locked} onPress={() => chooseLevel(item.id)} style={[styles.levelCell, { borderColor: theme.line, backgroundColor: done ? theme.line : theme.background }, item.id === level.id && styles.levelCurrent, locked && styles.levelLocked]}><AppText style={[styles.levelCellText, { color: done ? theme.background : theme.line }]}>{item.id}</AppText></Pressable>;
              })}
            </View>
            <View style={styles.menuActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Подсказка" onPress={() => { setMenuOpen(false); showHint(); }} style={[styles.menuAction, { backgroundColor: theme.line }]}><Ionicons name="bulb-outline" size={22} color={theme.background} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Начать заново" onPress={() => { setMenuOpen(false); reset(); }} style={[styles.menuAction, { backgroundColor: theme.line }]}><Ionicons name="refresh" size={22} color={theme.background} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Скины" onPress={() => { setMenuOpen(false); setEconomyOpen(true); }} style={[styles.menuAction, { backgroundColor: theme.line }]}><MaterialCommunityIcons name="palette" size={22} color={theme.background} /></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <GameEconomyModal gameId="loops" visible={economyOpen} onClose={() => setEconomyOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { minHeight: 58, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 10 },
  tinyButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  main: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  copyArea: { minHeight: 128, alignItems: "center", justifyContent: "center" },
  instruction: { fontSize: 18, lineHeight: 27, fontWeight: "500", textAlign: "center" },
  levelNumber: { fontSize: 25, lineHeight: 31, fontWeight: "500" },
  successCopy: { alignItems: "center", gap: 7 },
  successNumber: { fontSize: 26, lineHeight: 32, fontWeight: "700" },
  successText: { fontSize: 15, lineHeight: 23, fontWeight: "500", textAlign: "center" },
  successCoin: { fontSize: 12, lineHeight: 15, fontWeight: "700", opacity: 0.82 },
  board: { flexDirection: "row", flexWrap: "wrap", alignContent: "center", justifyContent: "center" },
  tile: { alignItems: "center", justifyContent: "center" },
  hinted: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 18 },
  dotMenu: { position: "absolute", right: 14, bottom: 14, width: 34, height: 34, padding: 7, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, opacity: 0.52 },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(15,10,14,0.42)" },
  menuPanel: { width: "100%", maxWidth: 560, maxHeight: "90%", borderRadius: 24, borderWidth: 2, padding: 16, gap: 15 },
  menuTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuTitle: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  menuClose: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  levelGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  levelCell: { width: 49, height: 49, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  levelCurrent: { borderWidth: 3 },
  levelLocked: { opacity: 0.28 },
  levelCellText: { fontSize: 12, lineHeight: 15, fontWeight: "800" },
  menuActions: { flexDirection: "row", justifyContent: "center", gap: 9 },
  menuAction: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.95 }] },
});
