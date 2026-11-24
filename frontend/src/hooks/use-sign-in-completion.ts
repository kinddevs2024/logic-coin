import { useCallback } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import type { SocialAuthResult } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export function useSignInCompletion(onAuthenticated?: (result: SocialAuthResult) => void) {
  const router = useRouter();
  return useCallback((result: SocialAuthResult) => {
    if ("setupToken" in result) {
      router.replace("/login");
      return;
    }
    if (onAuthenticated) return onAuthenticated(result);
    const state = useAppStore.getState();
    state.authenticate({
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      balanceUnits: result.user.wallet?.availableUnits,
    });
    const destination = result.user.role === "owner" ? Platform.OS === "web" ? "/admin" : "/owner" : result.user.role === "admin" ? Platform.OS === "web" ? "/admin" : "/(tabs)"
      : !result.user.countryCode
        ? state.postAuthLanguageUserId === result.user.id ? "/country" : "/language"
        : "/(tabs)";
    router.replace(destination as never);
  }, [onAuthenticated, router]);
}
