import { useAppStore } from "@/store/app-store";
import { copyText , Alert, Share } from "@/components/localized-native";
import * as Clipboard from "expo-clipboard";
import { Platform } from "react-native";


/** Share the canonical URL so the destination can fetch its server-rendered image. */
export async function shareLink(title: string, message: string, url: string) {
  title = copyText(title); message = copyText(message);
  const shared = new URL(url);
  shared.searchParams.set("lang", useAppStore.getState().language ?? "ru");
  url = shared.toString();
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
    await Clipboard.setStringAsync(`${message}\n${url}`);
    if (Platform.OS === "web") window.alert(copyText("Ссылка скопирована. Отправьте её в нужный чат."));
    else Alert.alert("Logic Coin", "Ссылка скопирована.");
  } catch {
    if (Platform.OS === "web") window.prompt(copyText("Скопируйте ссылку"), `${message}\n${url}`);
    else Alert.alert("Logic Coin", `${message}\n${url}`);
  }
}
