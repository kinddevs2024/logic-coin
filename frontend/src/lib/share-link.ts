import * as Clipboard from "expo-clipboard";
import { Alert, Platform, Share } from "react-native";

/** Share the canonical URL so the destination can fetch its server-rendered image. */
export async function shareLink(title: string, message: string, url: string) {
  try {
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: message, url });
        return;
      }
    } else {
      await Share.share({ title, message: `${message}\n${url}` });
      return;
    }
  } catch (error) {
    // Closing the system sheet is not an error and must not trigger another dialog.
    if (error instanceof Error && error.name === "AbortError") return;
  }
  try {
    await Clipboard.setStringAsync(url);
    if (Platform.OS === "web") window.alert("Ссылка скопирована. Отправьте её в нужный чат.");
    else Alert.alert("Logic Coin", "Ссылка скопирована.");
  } catch {
    if (Platform.OS === "web") window.prompt("Скопируйте ссылку", url);
    else Alert.alert("Logic Coin", url);
  }
}
