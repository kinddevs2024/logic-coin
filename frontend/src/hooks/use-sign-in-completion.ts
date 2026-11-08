import { useCallback } from "react";
import { useRouter } from "expo-router";
import type { SocialAuthResult } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export function useSignInCompletion(onAuthenticated?: (result: SocialAuthResult) => void) {
  const router = useRouter();
  return useCallback((result: SocialAuthResult) => {
    if ("setupToken" in result) {
      useAppStore.getState().setPendingPasswordSetupToken(result.setupToken);
      router.replace({ pathname: "/set-password", params: { source: "social", accountLabel: result.accountLabel } });
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
    const destination = result.user.role === "admin" ? "/admin"
      : !result.user.countryCode
        ? state.postAuthLanguageUserId === result.user.id ? "/country" : "/language"
        : "/(tabs)";
    router.replace(destination as never);
  }, [onAuthenticated, router]);
}
