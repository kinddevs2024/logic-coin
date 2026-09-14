import * as ImageManipulator from "expo-image-manipulator";
import { useMemo, useRef, useState } from "react";
import { Image, Modal, PanResponder, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";

type CropAsset = {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
};

export function PhotoCropEditor({
  asset,
  onCancel,
  onConfirm,
}: {
  asset: CropAsset | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const theme = useAppTheme();
  const viewport = 280;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const gesture = useRef({ x: 0, y: 0, distance: 0, zoom: 1 });
  const source = asset?.uri ?? "";
  const baseScale = asset ? Math.max(viewport / asset.width, viewport / asset.height) : 1;
  const displayWidth = (asset?.width ?? viewport) * baseScale * zoom;
  const displayHeight = (asset?.height ?? viewport) * baseScale * zoom;

  const clampOffset = (x: number, y: number, nextZoom = zoom) => {
    if (!asset) return { x: 0, y: 0 };
    const width = asset.width * baseScale * nextZoom;
    const height = asset.height * baseScale * nextZoom;
    return {
      x: Math.max((viewport - width) / 2, Math.min((width - viewport) / 2, x)),
      y: Math.max((viewport - height) / 2, Math.min((height - viewport) / 2, y)),
    };
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches;
      const first = touches[0];
      const second = touches[1];
      gesture.current = {
        x: offset.x,
        y: offset.y,
        distance: first && second ? Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY) : 0,
        zoom,
      };
    },
    onPanResponderMove: (event, state) => {
      const touches = event.nativeEvent.touches;
      const first = touches[0];
      const second = touches[1];
      if (first && second && gesture.current.distance > 0) {
        const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
        const nextZoom = Math.max(1, Math.min(3, gesture.current.zoom * (distance / gesture.current.distance)));
        setZoom(nextZoom);
        setOffset(clampOffset(gesture.current.x, gesture.current.y, nextZoom));
        return;
      }
      setOffset(clampOffset(gesture.current.x + state.dx, gesture.current.y + state.dy));
    },
  }), [asset, baseScale, offset, zoom]);

  const confirm = async () => {
    if (!asset) return;
    const left = (viewport - displayWidth) / 2 - offset.x;
    const top = (viewport - displayHeight) / 2 - offset.y;
    const scale = displayWidth / asset.width;
    const originX = Math.max(0, Math.min(asset.width - asset.height / (displayHeight / asset.height), -left / scale));
    const originY = Math.max(0, Math.min(asset.height - asset.width / (displayWidth / asset.width), -top / scale));
    const cropSize = Math.min(asset.width - originX, asset.height - originY);
    const result = await ImageManipulator.manipulateAsync(
      source,
      [{ crop: { originX, originY, width: cropSize, height: cropSize } }, { resize: { width: 640, height: 640 } }],
      { compress: 0.86, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (result.base64) onConfirm(`data:image/jpeg;base64,${result.base64}`);
  };

  if (!asset) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <AppText style={[styles.title, { color: theme.text }]}>Настройте фото</AppText>
          <AppText variant="caption" muted style={styles.subtitle}>Переместите фото и увеличьте двумя пальцами</AppText>
          <View style={styles.cropArea} {...panResponder.panHandlers}>
            <Image source={{ uri: source }} style={{ position: "absolute", width: displayWidth, height: displayHeight, left: (viewport - displayWidth) / 2 + offset.x, top: (viewport - displayHeight) / 2 + offset.y }} />
            <View pointerEvents="none" style={styles.grid}>
              <View style={styles.gridLineVertical} />
              <View style={styles.gridLineHorizontal} />
              <View style={styles.circle} />
            </View>
          </View>
          <View style={styles.zoomControls}>
            <Pressable accessibilityLabel="Уменьшить" onPress={() => { const nextZoom = Math.max(1, zoom - 0.15); setZoom(nextZoom); setOffset(clampOffset(offset.x, offset.y, nextZoom)); }} style={styles.zoomButton}><AppText color={String(theme.text)} style={styles.zoomText}>−</AppText></Pressable>
            <AppText variant="caption" muted>{Math.round(zoom * 100)}%</AppText>
            <Pressable accessibilityLabel="Увеличить" onPress={() => { const nextZoom = Math.min(3, zoom + 0.15); setZoom(nextZoom); setOffset(clampOffset(offset.x, offset.y, nextZoom)); }} style={styles.zoomButton}><AppText color={String(theme.text)} style={styles.zoomText}>+</AppText></Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.button, { backgroundColor: theme.surfaceRaised }]}><AppText color={String(theme.text)}>Отмена</AppText></Pressable>
            <Pressable onPress={() => void confirm()} style={[styles.button, { backgroundColor: theme.primary }]}><AppText color="#FFFFFF">Готово</AppText></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(4,16,38,0.72)" },
  card: { width: "100%", maxWidth: 380, borderRadius: 28, padding: 20, gap: 10 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: "900", textAlign: "center" },
  subtitle: { textAlign: "center" },
  cropArea: { width: 280, height: 280, alignSelf: "center", overflow: "hidden", borderRadius: 140, backgroundColor: "#101827" },
  grid: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", borderRadius: 140 },
  circle: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", borderRadius: 140 },
  gridLineVertical: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, backgroundColor: "rgba(255,255,255,0.35)" },
  gridLineHorizontal: { position: "absolute", left: 0, right: 0, top: "50%", height: 1, backgroundColor: "rgba(255,255,255,0.35)" },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  zoomControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  zoomButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#E8EDF5" },
  zoomText: { fontSize: 24, lineHeight: 27, fontWeight: "700" },
  button: { flex: 1, minHeight: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
