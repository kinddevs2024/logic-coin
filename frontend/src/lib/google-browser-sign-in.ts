import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

import { ApiError, authApi } from "@/lib/api";

const storageKey = "logic-coin-google-browser-flow";

export async function openGoogleBrowserSignIn() {
  const { url, ...flow } = await authApi.startGoogleBrowser();
  await SecureStore.setItemAsync(storageKey, JSON.stringify(flow));
  try {
    await Linking.openURL(url);
  } catch (error) {
    await SecureStore.deleteItemAsync(storageKey);
    throw error;
  }
}

export async function completeGoogleBrowserSignIn(browserToken: string) {
  const stored = await SecureStore.getItemAsync(storageKey);
  const flow = stored ? JSON.parse(stored) as { flowId: string; pollToken: string; expiresAt: string } : null;
  if (!flow || !(Date.parse(flow.expiresAt) > Date.now())) {
    throw new ApiError("Google sign-in has expired. Try again.", 400, "invalid_google_flow");
  }
  const result = await authApi.completeGoogleBrowser({
    flowId: flow.flowId,
    pollToken: flow.pollToken,
    browserToken,
  });
  await SecureStore.deleteItemAsync(storageKey);
  return result;
}
