import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { CardScannerShell } from "@/components/card-scanner-shell";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { withdrawalsApi } from "@/lib/api";
import { cardScannerCopy, type CardScannerProps } from "@/lib/card-scanner-copy";

export function CardScanner(props: CardScannerProps) { return props.visible ? <WebCardScanner {...props} /> : null; }
function WebCardScanner({ token, onClose, onScanned }: CardScannerProps) {
  const { language } = useTranslation(); const c = cardScannerCopy[language]; const theme = useAppTheme();
  const video = useRef<HTMLVideoElement | null>(null), file = useRef<HTMLInputElement | null>(null);
  const stream = useRef<MediaStream | null>(null), controller = useRef<AbortController | null>(null);
  const mounted = useRef(true), inFlight = useRef(false), autoStarted = useRef(false);
  const callbacks = useRef({ onScanned });
  useEffect(() => { callbacks.current = { onScanned }; }, [onScanned]);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");

  const read = useCallback(async (base64: string) => {
    if (!token) throw new Error(c.login);
    controller.current = new AbortController();
    const result = await withdrawalsApi.scanCard(base64, token, controller.current.signal);
    if (mounted.current) callbacks.current.onScanned(result.number);
  }, [token, c]);
  const scan = useCallback(async () => {
    const camera = video.current;
    if (inFlight.current || !camera?.videoWidth) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const canvas = document.createElement("canvas");
      const width = Math.min(camera.videoWidth, camera.videoHeight * 1.6), height = width / 1.6;
      canvas.width = Math.min(1600, width); canvas.height = canvas.width / 1.6;
      canvas.getContext("2d")!.drawImage(camera, (camera.videoWidth - width) / 2, (camera.videoHeight - height) / 2, width, height, 0, 0, canvas.width, canvas.height);
      await read(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]!);
      canvas.width = canvas.height = 0;
    } catch { if (mounted.current) setError(c.failed); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }, [read, c]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
        const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
      } catch { if (mounted.current) setError(c.permission); }
    })();
    return () => { mounted.current = false; controller.current?.abort(); stream.current?.getTracks().forEach(track => track.stop()); };
  }, [c]);
  useEffect(() => {
    if (!ready || autoStarted.current) return;
    const timer = setTimeout(() => { autoStarted.current = true; void scan(); }, 1800);
    return () => clearTimeout(timer);
  }, [ready, scan]);

  async function readFile(selected?: File) {
    if (!selected || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); let url: string | undefined;
    try {
      if (selected.size > 15000000) throw new Error("Photo too large");
      url = URL.createObjectURL(selected); const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url!; });
      const canvas = document.createElement("canvas"), ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (mounted.current) await read(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]!);
      canvas.width = canvas.height = 0;
    } catch { if (mounted.current) setError(c.failed); }
    finally { if (url) URL.revokeObjectURL(url); inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <CardScannerShell onClose={onClose}>
    <div style={{ position: "relative", width: "100%", aspectRatio: "1.6", borderRadius: 16, overflow: "hidden", background: "#10231d" }}>
      <video ref={video} data-testid="card-scanner-video" aria-label={c.title} autoPlay playsInline muted onLoadedData={() => setReady(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div aria-hidden style={{ position: "absolute", inset: "8%", border: "2px solid #FFFFFF", borderRadius: 14, pointerEvents: "none" }} />
      {!ready && !error ? <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#FFFFFF" /></View> : null}
    </div>
    <AppText variant="caption" muted>{c.hint}</AppText>
    {error ? <AppText accessibilityRole="alert" color={String(theme.danger)}>{error}</AppText> : null}
    {busy ? <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ActivityIndicator color={String(theme.primary)} /><AppText accessibilityLiveRegion="polite">{c.reading}</AppText></View> : null}
    <AppButton icon="scan-outline" disabled={!ready || busy} onPress={() => void scan()}>{c.scan}</AppButton>
    <AppButton icon="image-outline" variant="ghost" disabled={busy} onPress={() => file.current?.click()}>{c.photo}</AppButton>
    <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" aria-label={c.photo} style={{ display: "none" }} onChange={event => { const selected = event.target.files?.[0]; event.target.value = ""; void readFile(selected); }} />
  </CardScannerShell>;
}
