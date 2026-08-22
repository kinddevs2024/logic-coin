import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppText } from "@/components/app-text";
import { GameShell } from "@/components/game-shell";
import { GlassSurface } from "@/components/glass-surface";
import { validatePuzzleDefinition } from "@/games/brain-tricks/engine";
import type { PuzzleDefinition, PuzzleObjectDefinition } from "@/games/brain-tricks/types";

const STARTER: PuzzleDefinition = {
  id: 999, stage: 1, title: "Новая задача", instruction: "Что нужно сделать?", background: "#FDE68A",
  objects: [{ id: "object-1", symbol: "⭐", position: { x: 50, y: 50 }, size: 14, color: "#FDE68A", visible: true, tappable: true, layer: "OBJECT" }],
  rules: [], successConditions: [], hints: ["Первая подсказка", "Вторая подсказка", "Третья подсказка"],
};

export default function BrainTricksEditor() {
  const [level, setLevel] = useState<PuzzleDefinition>(STARTER);
  const [selectedId, setSelectedId] = useState("object-1");
  const validation = useMemo(() => validatePuzzleDefinition(level), [level]);
  if (!__DEV__) return <Redirect href="/" />;
  const selected = level.objects.find((item) => item.id === selectedId) ?? level.objects[0];
  const updateObject = (patch: Partial<PuzzleObjectDefinition>) => setLevel((current) => ({ ...current, objects: current.objects.map((item) => item.id === selectedId ? { ...item, ...patch } : item) }));
  const move = (dx: number, dy: number) => selected && updateObject({ position: { x: Math.max(0, Math.min(100, selected.position.x + dx)), y: Math.max(0, Math.min(100, selected.position.y + dy)) } });
  const addObject = () => {
    const id = `object-${level.objects.length + 1}`;
    setLevel((current) => ({ ...current, objects: [...current.objects, { id, symbol: "🔷", position: { x: 50, y: 50 }, size: 14, color: "#93C5FD", visible: true, draggable: true, layer: "OBJECT" }] }));
    setSelectedId(id);
  };
  return <GameShell title="Brain Tricks Editor" variant="app" meta={<AppText style={styles.dev}>DEV</AppText>}>
    <View style={styles.layout}>
      <GlassSurface variant="strong" style={styles.controls}>
        <AppText style={styles.heading}>Параметры</AppText>
        <TextInput accessibilityLabel="Название задачи" value={level.title} onChangeText={(title) => setLevel((current) => ({ ...current, title }))} style={styles.input} />
        <TextInput accessibilityLabel="Текст задания" value={level.instruction} onChangeText={(instruction) => setLevel((current) => ({ ...current, instruction }))} style={styles.input} />
        <View style={styles.row}><Pressable onPress={addObject} style={styles.button}><Ionicons name="add" size={18} color="#fff" /><AppText style={styles.buttonText}>Объект</AppText></Pressable><Pressable onPress={() => void Clipboard.setStringAsync(JSON.stringify(level, null, 2))} style={styles.button}><Ionicons name="copy-outline" size={18} color="#fff" /><AppText style={styles.buttonText}>JSON</AppText></Pressable></View>
        <AppText style={styles.label}>Выбран: {selectedId}</AppText>
        <View style={styles.row}><Pressable onPress={() => move(-2, 0)} style={styles.nudge}><Ionicons name="arrow-back" size={18} /></Pressable><Pressable onPress={() => move(0, -2)} style={styles.nudge}><Ionicons name="arrow-up" size={18} /></Pressable><Pressable onPress={() => move(0, 2)} style={styles.nudge}><Ionicons name="arrow-down" size={18} /></Pressable><Pressable onPress={() => move(2, 0)} style={styles.nudge}><Ionicons name="arrow-forward" size={18} /></Pressable></View>
        <Pressable onPress={() => selected && updateObject({ draggable: !selected.draggable })} style={styles.toggle}><AppText style={styles.label}>Draggable: {selected?.draggable ? "ON" : "OFF"}</AppText></Pressable>
        <AppText style={[styles.validation, { color: validation.valid ? "#15803D" : "#B42318" }]}>{validation.valid ? "Definition valid" : validation.errors.join("\n")}</AppText>
      </GlassSurface>
      <View style={[styles.canvas, { backgroundColor: level.background }]}>{level.objects.map((item) => <Pressable key={item.id} onPress={() => setSelectedId(item.id)} style={[styles.editorObject, { left: `${item.position.x}%`, top: `${item.position.y}%` }, item.id === selectedId && styles.editorObjectSelected]}><AppText style={styles.symbol}>{item.symbol}</AppText><AppText style={styles.objectId}>{item.id}</AppText></Pressable>)}</View>
    </View>
  </GameShell>;
}

const styles = StyleSheet.create({
  dev: { color: "#087CFF", fontSize: 11, fontWeight: "900" },
  layout: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  controls: { flex: 1, minWidth: 280, borderRadius: 26, padding: 16, gap: 10 },
  heading: { fontSize: 18, fontWeight: "900" },
  input: { minHeight: 46, borderRadius: 15, borderWidth: 1, borderColor: "rgba(8,124,255,0.2)", paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.55)" },
  row: { flexDirection: "row", gap: 8 },
  button: { minHeight: 42, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#087CFF" },
  buttonText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  label: { fontSize: 11, fontWeight: "800" },
  nudge: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,124,255,0.1)" },
  toggle: { minHeight: 42, justifyContent: "center", paddingHorizontal: 12, borderRadius: 14, backgroundColor: "rgba(8,124,255,0.08)" },
  validation: { fontSize: 10, lineHeight: 14, fontWeight: "700" },
  canvas: { flex: 2, minWidth: 320, minHeight: 520, borderRadius: 26, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  editorObject: { position: "absolute", width: 76, minHeight: 72, marginLeft: -38, marginTop: -36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  editorObjectSelected: { borderWidth: 2, borderColor: "#087CFF", backgroundColor: "rgba(255,255,255,0.38)" },
  symbol: { fontSize: 34 },
  objectId: { fontSize: 8, fontWeight: "800" },
});

