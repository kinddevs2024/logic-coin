import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { CardScannerShell } from "@/components/card-scanner-shell";
import { useTranslation } from "@/hooks/use-translation";
import { useAppTheme } from "@/hooks/use-app-theme";
import { withdrawalsApi } from "@/lib/api";
import { cardScannerCopy, type CardScannerProps } from "@/lib/card-scanner-copy";

export function CardScanner(props: CardScannerProps) { return props.visible ? <NativeCardScanner {...props} /> : null; }
function NativeCardScanner({ token, onClose, onScanned }: CardScannerProps) {
  const { language } = useTranslation(); const c = cardScannerCopy[language]; const theme = useAppTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const active = useRef(true), controller = useRef<AbortController | null>(null), started = useRef(false);
  const callbacks = useRef({ onClose, onScanned });
  useEffect(() => { callbacks.current = { onClose, onScanned }; }, [onClose, onScanned]);
  const pick = useCallback(async (camera: boolean) => {
    setBusy(true); setError(""); const temporary: string[] = [];
    try {
      if (!token) throw new Error(c.login);
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error(c.permission);
      if (!active.current) return;
      const options = { mediaTypes: ["images"] as ImagePicker.MediaType[], quality: 0.9, exif: false };
      const photo = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (photo.canceled) { if (active.current) callbacks.current.onClose(); return; }
      const asset = photo.assets[0]; if (!asset || !active.current) return;
      if (camera) temporary.push(asset.uri);
      const width = Math.min(asset.width, Math.round(asset.width * 1600 / Math.max(asset.width, asset.height)));
      const image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: Math.max(1, width) } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      temporary.push(image.uri);
      if (!image.base64 || !active.current) return;
      controller.current = new AbortController();
      const result = await withdrawalsApi.scanCard(image.base64, token, controller.current.signal);
      if (active.current) callbacks.current.onScanned(result.number);
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : c.failed); }
    finally {
      for (const uri of temporary) if (uri.startsWith("file://") && uri.includes("/cache/")) void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      if (active.current) setBusy(false);
    }
  }, [token, c]);
  useEffect(() => {
    active.current = true;
    if (!started.current) { started.current = true; void pick(true); }
    return () => { active.current = false; controller.current?.abort(); };
  }, [pick]);
  return <CardScannerShell onClose={onClose}>
    <View style={{ minHeight: 150, justifyContent: "center", alignItems: "center", gap: 14 }}>
      {busy ? <><ActivityIndicator color={String(theme.primary)} size="large" /><AppText>{c.reading}</AppText></> : <AppText accessibilityRole="alert">{error || c.hint}</AppText>}
    </View>
    <AppButton icon="camera-outline" disabled={busy} onPress={() => void pick(true)}>{c.retry}</AppButton>
    <AppButton icon="image-outline" variant="ghost" disabled={busy} onPress={() => void pick(false)}>{c.photo}</AppButton>
  </CardScannerShell>;
}
