import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { LogoMark } from "@/components/logo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { launchAdShown } from "@/lib/launch-ad";
import { useAppStore } from "@/store/app-store";

export default function IndexScreen() {
  const theme = useAppTheme();
  const hydrated = useAppStore((state) => state.hydrated);
  const language = useAppStore((state) => state.language);
  const onboardingDone = useAppStore((state) => state.onboardingDone);
  const authMode = useAppStore((state) => state.authMode);

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          backgroundColor: theme.background,
        }}
      >
        <LogoMark size={78} />
        <ActivityIndicator color={String(theme.primary)} />
      </View>
    );
  }
  if (!launchAdShown()) return <Redirect href="/ads" />;
  if (!language) return <Redirect href="/language" />;
  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (!authMode) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
