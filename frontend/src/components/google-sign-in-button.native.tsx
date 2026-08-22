import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

export function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    GoogleSignin.configure({ webClientId: clientId, offlineAccess: false });
  }, [clientId]);

  const signIn = async () => {
    if (!clientId || busy || disabled) return;
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (result.type === "success" && result.data.idToken) {
        onCredential(result.data.idToken);
      }
    } catch (error) {
      Alert.alert("Google", error instanceof Error ? error.message : "Google Sign-In failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Google"
      onPress={() => void signIn()}
      disabled={disabled || busy || !clientId}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <GlassSurface intensity={48} variant="soft" style={styles.surface}>
        <View style={[styles.icon, { backgroundColor: "#FFFFFF" }]}>
          <Ionicons name="logo-google" color="#4285F4" size={20} />
        </View>
        <AppText variant="label">Google</AppText>
        {busy ? (
          <ActivityIndicator size="small" color={String(theme.textMuted)} />
        ) : (
          <Ionicons name="arrow-forward" size={18} color={String(theme.textMuted)} />
        )}
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { minHeight: 54, borderRadius: 999 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  surface: {
    minHeight: 54,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
