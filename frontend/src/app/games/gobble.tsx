import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, runOnJS } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/app-text";
import { GameEconomyHud, GameEconomyModal } from "@/components/game-economy";
import { cosmeticFor } from "@/games/cosmetics";
import { clampHole, evaluateVortexCollision, grownHoleRadius, requiredEntityCount } from "@/games/gobble/engine";
import { getVortexLevel, VORTEX_LEVELS } from "@/games/gobble/levels";
import type { VortexEntity, VortexEntityKind } from "@/games/gobble/types";
import { gameProgressFor, useGameProgressStore } from "@/games/progress-store";
import { useClientReady } from "@/hooks/use-client-ready";

const PEACH = "#FBB181";
const GOBBLE_BLOCK = require("../../../assets/games/gobble-block.png");
type RuntimeEntity = VortexEntity & { phase: "ACTIVE" | "FALLING" | "SWALLOWED" };

const ENTITY_ICONS: Record<VortexEntityKind, React.ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  crate: "package-variant-closed",
  ball: "soccer",
  plant: "cactus",
  cone: "traffic-cone",
  fruit: "food-apple",
  human: "human-greeting",
};

const ENTITY_COLORS: Record<VortexEntityKind, string> = {
  crate: "#BE647A",
  ball: "#E5E7EB",
  plant: "#21B85A",
  cone: "#F59E0B",
  fruit: "#F43F5E",
  human: "#394258",
};

function GameButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.gameButton, pressed && styles.pressed]}><Ionicons name={icon} size={25} color="#424556" /></Pressable>;
}

function EntitySprite({ entity, fieldSize }: { entity: RuntimeEntity; fieldSize: number }) {
  if (entity.phase === "SWALLOWED") return null;
  const size = Math.max(70, entity.radius * fieldSize * 9.2);
  const displayX = 0.5 + (entity.position.x - 0.5) * 1.35;
  const displayY = 0.5 + (entity.position.y - 0.5) * 1.25;
  return (
    <Animated.View entering={FadeIn.duration(130)} exiting={FadeOut.duration(220)} pointerEvents="none" style={[styles.entity, {
      left: displayX * fieldSize - size / 2,
      top: displayY * fieldSize - size / 2,
      width: size,
      height: size,
    }]}>
      <Animated.View style={[styles.entityInner, {
        opacity: entity.phase === "FALLING" ? 0.22 : 1,
        transform: [{ scale: entity.phase === "FALLING" ? 0.35 : 1 }],
      }]}>
        {entity.kind === "crate" ? (
          <Image source={GOBBLE_BLOCK} resizeMode="contain" style={{ width: size, height: size }} />
        ) : (
          <MaterialCommunityIcons name={ENTITY_ICONS[entity.kind]} size={size * 0.82} color={ENTITY_COLORS[entity.kind]} />
        )}
      </Animated.View>
    </Animated.View>
  );
}

export default function GobbleScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const ready = useClientReady();
  const saved = useGameProgressStore((state) => gameProgressFor(state.games, "gobble"));
  const progress = ready ? saved : gameProgressFor({}, "gobble");
  const hydrated = useGameProgressStore((state) => state.hydrated);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);
  const setCurrentLevel = useGameProgressStore((state) => state.setCurrentLevel);
  const [levelId, setLevelId] = useState(() => Math.min(progress.currentLevel, VORTEX_LEVELS.length));
  const level = useMemo(() => getVortexLevel(levelId), [levelId]);
  const [hole, setHole] = useState({ ...level.holeStart, radius: level.hole.radius });
  const [entities, setEntities] = useState<RuntimeEntity[]>(() => level.entities.map((entity) => ({ ...entity, position: { ...entity.position }, phase: "ACTIVE" })));
  const [status, setStatus] = useState<"PLAYING" | "COMPLETE" | "FAILED">("PLAYING");
  const [menuOpen, setMenuOpen] = useState(false);
  const [economyOpen, setEconomyOpen] = useState(false);
  const [moves, setMoves] = useState(0);
  const pending = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hydrationApplied = useRef(false);
  const fieldSize = Math.max(300, Math.min(width - 16, height - 112, 690));
  const skin = cosmeticFor("gobble", progress.selectedCosmetic);
  const visualHoleRadius = hole.radius * 3.2;

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pending.current.clear();
  }, []);

  const reset = useCallback((next = level) => {
    clearTimers();
    setHole({ ...next.holeStart, radius: next.hole.radius });
    setEntities(next.entities.map((entity) => ({ ...entity, position: { ...entity.position }, phase: "ACTIVE" })));
    setMoves(0);
    setStatus("PLAYING");
  }, [clearTimers, level]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!hydrated || hydrationApplied.current) return;
    hydrationApplied.current = true;
    const nextId = Math.min(progress.currentLevel, VORTEX_LEVELS.length);
    if (nextId === levelId) return;
    const timer = setTimeout(() => {
      const next = getVortexLevel(nextId);
      setLevelId(nextId);
      reset(next);
    }, 0);
    return () => clearTimeout(timer);
  }, [hydrated, levelId, progress.currentLevel, reset]);

  const chooseLevel = useCallback((id: number) => {
    if (id > progress.highestUnlockedLevel) return;
    const next = getVortexLevel(id);
    setLevelId(id);
    setCurrentLevel("gobble", id);
    reset(next);
    setMenuOpen(false);
  }, [progress.highestUnlockedLevel, reset, setCurrentLevel]);

  useEffect(() => {
    if (status !== "PLAYING") return;
    const collisionTimer = setTimeout(() => {
      const collisions = entities.filter((entity) => entity.phase === "ACTIVE").map((entity) => ({ entity, collision: evaluateVortexCollision(hole, entity) }));
      if (collisions.some((item) => item.collision === "HUMAN_FAIL")) {
        setStatus("FAILED");
        return;
      }
      for (const { entity, collision } of collisions) {
        if (collision !== "SWALLOW" || pending.current.has(entity.id)) continue;
        pending.current.add(entity.id);
        setEntities((current) => current.map((item) => item.id === entity.id ? { ...item, phase: "FALLING" } : item));
        const timer = setTimeout(() => {
          setEntities((current) => current.map((item) => item.id === entity.id ? { ...item, phase: "SWALLOWED" } : item));
          setHole((current) => ({ ...current, radius: grownHoleRadius(level, current.radius, entity.mass) }));
        }, 260);
        timers.current.push(timer);
      }
    }, 0);
    return () => clearTimeout(collisionTimer);
  }, [entities, hole, level, status]);

  const required = requiredEntityCount(level);
  const swallowed = entities.filter((entity) => entity.required && entity.phase === "SWALLOWED").length;
  useEffect(() => {
    if (status !== "PLAYING" || swallowed !== required || required === 0) return;
    const timer = setTimeout(() => {
      completeLevel("gobble", level.id, { moves, score: Math.max(100, 3200 - moves * 4), result: `Уровень ${level.id}` });
      setStatus("COMPLETE");
    }, 0);
    return () => clearTimeout(timer);
  }, [completeLevel, level.id, moves, required, status, swallowed]);

  const moveHole = useCallback((dx: number, dy: number) => {
    if (status !== "PLAYING") return;
    setHole((current) => ({ ...current, ...clampHole({ x: current.x + dx, y: current.y + dy }, current.radius) }));
    setMoves((value) => value + 1);
  }, [status]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const delta = ({ ArrowUp: [0, -0.03], ArrowDown: [0, 0.03], ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0] } as Record<string, [number, number] | undefined>)[event.key];
      if (!delta) return;
      event.preventDefault();
      moveHole(delta[0], delta[1]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveHole]);

  const drag = useMemo(() => Gesture.Pan().onChange((event) => {
    "worklet";
    runOnJS(moveHole)(event.changeX / fieldSize, event.changeY / fieldSize);
  }), [fieldSize, moveHole]);

  const next = () => level.id < VORTEX_LEVELS.length ? chooseLevel(level.id + 1) : setMenuOpen(true);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.topBar}>
        <GameButton icon="pause" label="Уровни" onPress={() => setMenuOpen(true)} />
        <View style={styles.levelPill}><AppText style={styles.levelPillText}>Level {level.id}</AppText></View>
        <View style={styles.topActions}>
          <GameEconomyHud gameId="gobble" onOpen={() => setEconomyOpen(true)} />
          <GameButton icon="refresh" label="Начать заново" onPress={() => reset()} />
        </View>
      </View>

      <GestureDetector gesture={drag}>
        <View style={styles.stage}>
          <View style={[styles.field, { width: fieldSize, height: fieldSize }]}>
            <View style={styles.groundShadow} />
            <MaterialCommunityIcons pointerEvents="none" name="cactus" size={fieldSize * 0.16} color="#20B65A" style={styles.cactusLeft} />
            <MaterialCommunityIcons pointerEvents="none" name="cactus" size={fieldSize * 0.14} color="#20B65A" style={styles.cactusRight} />
            {entities.map((entity) => <EntitySprite key={entity.id} entity={entity} fieldSize={fieldSize} />)}
            <View pointerEvents="none" style={[styles.holeRim, {
              left: (hole.x - visualHoleRadius) * fieldSize,
              top: (hole.y - visualHoleRadius * 0.58) * fieldSize,
              width: visualHoleRadius * fieldSize * 2,
              height: visualHoleRadius * fieldSize * 1.16,
              backgroundColor: skin.secondary,
            }]}>
              <View style={[styles.holeCore, { backgroundColor: skin.primary }]} />
            </View>

            {status === "FAILED" ? (
              <Animated.View entering={FadeIn.duration(180)} style={styles.resultLayer}>
                <MaterialCommunityIcons name="account-alert" size={54} color="#424556" />
                <Pressable accessibilityRole="button" accessibilityLabel="Повторить" onPress={() => reset()} style={styles.blueAction}><Ionicons name="refresh" size={30} color="#FFFFFF" /></Pressable>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </GestureDetector>

      {status === "COMPLETE" ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.completeLayer}>
          <View style={styles.polaroid}>
            <View style={styles.polaroidPhoto}>
              <MaterialCommunityIcons name="circle-opacity" size={88} color={skin.primary} />
            </View>
            <AppText style={styles.miracle}>Miracle</AppText>
            <AppText style={styles.reward}>+{25 + Math.min(25, level.id)} coin</AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Следующий уровень" onPress={next} style={styles.nextBar}>
            <Ionicons name="play" size={35} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <View style={styles.menuPanel}>
            <View style={styles.menuTop}>
              <Pressable accessibilityRole="button" accessibilityLabel="Назад в приложение" onPress={() => router.back()} style={styles.gameButton}><Ionicons name="chevron-back" size={25} color="#424556" /></Pressable>
              <AppText style={styles.menuTitle}>Levels</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => setMenuOpen(false)} style={styles.gameButton}><Ionicons name="close" size={25} color="#424556" /></Pressable>
            </View>
            <View style={styles.levelGrid}>
              {VORTEX_LEVELS.map((item) => {
                const locked = item.id > progress.highestUnlockedLevel;
                const done = progress.completedLevels.includes(item.id);
                return <Pressable key={item.id} disabled={locked} onPress={() => chooseLevel(item.id)} style={[styles.levelButton, done && styles.levelDone, item.id === level.id && styles.levelCurrent, locked && styles.levelLocked]}><AppText style={styles.levelNumber}>{item.id}</AppText></Pressable>;
              })}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Продолжить" onPress={() => setMenuOpen(false)} style={styles.nextBar}><Ionicons name="play" size={32} color="#FFFFFF" /></Pressable>
          </View>
        </View>
      </Modal>

      <GameEconomyModal gameId="gobble" visible={economyOpen} onClose={() => setEconomyOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PEACH },
  topBar: { minHeight: 62, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 12 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  gameButton: { width: 46, height: 46, borderRadius: 15, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#F3F4F8", alignItems: "center", justifyContent: "center", shadowColor: "#413D4B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.72, shadowRadius: 0 },
  levelPill: { minHeight: 38, borderRadius: 16, paddingHorizontal: 18, backgroundColor: "#FFFFFF", borderWidth: 3, borderColor: "#424556", alignItems: "center", justifyContent: "center" },
  levelPillText: { color: "#A8B3C6", fontSize: 12, lineHeight: 15, fontWeight: "900" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  field: { position: "relative", overflow: "hidden" },
  groundShadow: { position: "absolute", left: "18%", right: "18%", top: "38%", height: "31%", borderRadius: 999, backgroundColor: "rgba(190,74,58,0.13)", transform: [{ rotate: "-12deg" }] },
  cactusLeft: { position: "absolute", left: "10%", top: "28%", zIndex: 2 },
  cactusRight: { position: "absolute", right: "9%", top: "24%", zIndex: 2 },
  entity: { position: "absolute", alignItems: "center", justifyContent: "center", zIndex: 5, shadowColor: "#B3523F", shadowOffset: { width: 8, height: 9 }, shadowOpacity: 0.35, shadowRadius: 0 },
  entityInner: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  holeRim: { position: "absolute", borderRadius: 999, padding: 6, zIndex: 4, shadowColor: "#7F2630", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.45, shadowRadius: 0 },
  holeCore: { flex: 1, borderRadius: 999 },
  resultLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(255,185,143,0.82)", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 30 },
  blueAction: { width: 68, height: 58, borderRadius: 17, backgroundColor: "#078CF0", borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#123A6A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.8, shadowRadius: 0 },
  completeLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 15, padding: 20, backgroundColor: "rgba(255,185,143,0.88)", zIndex: 40 },
  polaroid: { width: "78%", maxWidth: 390, padding: 18, paddingBottom: 26, backgroundColor: "#FFFFFF", transform: [{ rotate: "-5deg" }], shadowColor: "#764C42", shadowOffset: { width: 8, height: 10 }, shadowOpacity: 0.45, shadowRadius: 0, alignItems: "center", gap: 6 },
  polaroidPhoto: { width: "100%", aspectRatio: 1.3, backgroundColor: PEACH, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFE5D4" },
  miracle: { color: "#A8B3C6", fontSize: 20, lineHeight: 25, fontWeight: "900" },
  reward: { color: "#C78B00", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  nextBar: { width: "100%", maxWidth: 520, minHeight: 66, borderRadius: 17, backgroundColor: "#078CF0", borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#123A6A", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.9, shadowRadius: 0 },
  menuBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(195,82,60,0.45)" },
  menuPanel: { width: "100%", maxWidth: 620, maxHeight: "93%", borderRadius: 28, padding: 17, backgroundColor: PEACH, borderWidth: 4, borderColor: "#FFFFFF", gap: 18 },
  menuTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuTitle: { color: "#0C0D12", fontSize: 36, lineHeight: 43, fontWeight: "900", textShadowColor: "#FFFFFF", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  levelGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  levelButton: { width: 58, height: 58, borderRadius: 14, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#66687B", alignItems: "center", justifyContent: "center", shadowColor: "#222431", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0 },
  levelDone: { backgroundColor: "#35C34A" },
  levelCurrent: { backgroundColor: "#078CF0" },
  levelLocked: { opacity: 0.58 },
  levelNumber: { color: "#FFFFFF", fontSize: 17, lineHeight: 21, fontWeight: "900" },
  pressed: { transform: [{ scale: 0.95 }] },
});
