import { UIManager, View } from "react-native";
import { AppText } from "./app-text";
import { useTranslation } from "@/hooks/use-translation";
import { raffleCopy } from "@/lib/raffle";
// Old OTA-compatible APKs must never import a native component they do not contain.
export const supportsYoutubePlayer = Boolean(UIManager.getViewManagerConfig("RNCWebView"));
const WebView = supportsYoutubePlayer ? require("react-native-webview").WebView as typeof import("react-native-webview").WebView : null;
export function YoutubePlayer({ videoId }: { videoId: string }) {
  const { language } = useTranslation();
  if (!WebView) return <AppText>{raffleCopy[language].update}</AppText>;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  const origin = "https://logic-coin.online";
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#000"><iframe title="YouTube Live" style="position:absolute;border:0;width:100%;height:100%" src="https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&origin=${encodeURIComponent(origin)}" allow="autoplay;encrypted-media;picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
  return <View style={{ height: 220, width: "100%", borderRadius: 18, overflow: "hidden", backgroundColor: "#000" }}>
    <WebView source={{ html, baseUrl: origin }} originWhitelist={["https://*"]} javaScriptEnabled mediaPlaybackRequiresUserAction allowsInlineMediaPlayback allowsFullscreenVideo={false} setSupportMultipleWindows={false} style={{ backgroundColor: "#000" }} />
  </View>;
}
