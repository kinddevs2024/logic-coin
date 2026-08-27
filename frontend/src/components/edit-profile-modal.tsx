import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInUp, FadeOut } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { CountryFlagBadge, countryName } from "@/components/country-flag";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { meApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const user = useAppStore((state) => state.user);
  if (!visible) return null;
  return (
    <EditProfileModalContent
      key={`${user.name}:${user.avatarUrl ?? ""}`}
      onClose={onClose}
    />
  );
}

function EditProfileModalContent({ onClose }: { onClose: () => void }) {
  const theme = useAppTheme();
  const { t, language } = useTranslation();
  const user = useAppStore((state) => state.user);
  const updateUser = useAppStore((state) => state.updateUser);
  const accessToken = useAppStore((state) => state.accessToken);
  const authMode = useAppStore((state) => state.authMode);
  const [name, setName] = useState(user.name);
  const [avatarDataUrl, setAvatarDataUrl] = useState(user.avatarUrl ?? "");
  const [countryCode, setCountryCode] = useState(user.countryCode ?? (language === "uz" ? "UZ" : language === "en" ? "US" : "RU"));
  const [message, setMessage] = useState("");
  const [picking, setPicking] = useState(false);
  const queryClient = useQueryClient();

  const pickAvatar = async () => {
    setMessage("");
    setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("Разрешите доступ к фотографиям");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = asset?.mimeType?.toLowerCase() ?? "image/jpeg";
      if (!asset?.base64 || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        setMessage("Выберите JPG, PNG или WebP");
        return;
      }
      const nextAvatar = `data:${mimeType};base64,${asset.base64}`;
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024 || nextAvatar.length > 14_000_000) {
        setMessage("Файл слишком большой. Выберите фото до 10 МБ");
        return;
      }
      setAvatarDataUrl(nextAvatar);
    } catch {
      setMessage("Не удалось загрузить фотографию");
    } finally {
      setPicking(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim().slice(0, 80);
      if (!cleanName) throw new Error("name_required");
      if (authMode === "authenticated" && accessToken) {
        return meApi.updateProfile({ name: cleanName, avatarDataUrl: avatarDataUrl || null, countryCode }, accessToken);
      }
      return { ...user, name: cleanName, avatarUrl: avatarDataUrl || null, countryCode };
    },
    onSuccess: (nextUser) => {
      updateUser(nextUser);
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      onClose();
    },
    onError: () => setMessage(t("auth.invalid")),
  });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify().damping(20)} style={styles.wrap}>
          <GlassSurface intensity={88} variant="strong" style={styles.card}>
            <View style={styles.top}>
              <AppText style={[styles.title, { color: theme.text }]}>{t("profile.edit")}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onClose} style={[styles.close, { backgroundColor: theme.primarySoft }]}><Ionicons name="close" size={19} color={String(theme.text)} /></Pressable>
            </View>
            <View style={styles.preview}>
              <Avatar name={name || user.name} avatarUrl={avatarDataUrl || null} size={92} />
              <Pressable accessibilityRole="button" disabled={picking} onPress={() => void pickAvatar()} style={[styles.photoButton, { backgroundColor: theme.primarySoft }]}>
                {picking ? <ActivityIndicator size="small" color={String(theme.primary)} /> : <Ionicons name="camera-outline" size={17} color={String(theme.primary)} />}
                <AppText variant="caption" color={String(theme.primary)}>Выбрать и обрезать</AppText>
              </Pressable>
              <AppText variant="caption" muted style={styles.cropHint}>До 10 МБ · переместите фото в круге перед подтверждением</AppText>
              {avatarDataUrl ? (
                <Pressable accessibilityRole="button" onPress={() => setAvatarDataUrl("")} style={styles.removePhoto}>
                  <Ionicons name="trash-outline" size={14} color="#C33B4A" />
                  <AppText style={styles.removePhotoText}>Удалить</AppText>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.field}>
              <AppText variant="caption" muted>{t("profile.name")}</AppText>
              <TextInput value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" placeholder={t("profile.name")} placeholderTextColor={String(theme.textMuted)} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]} />
            </View>
            <View style={styles.field}>
              <AppText variant="caption" muted>Страна</AppText>
              <View style={styles.countryOptions}>
                {(["RU", "UZ", "US"] as const).map((code) => (
                  <Pressable key={code} accessibilityRole="radio" accessibilityState={{ checked: countryCode === code }} onPress={() => setCountryCode(code)} style={[styles.countryOption, { borderColor: countryCode === code ? theme.primary : theme.border, backgroundColor: countryCode === code ? theme.primarySoft : theme.surfaceRaised }]}>
                    <CountryFlagBadge countryCode={code} size={22} />
                    <AppText variant="caption" numberOfLines={1}>{countryName(code, language)}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            {message ? <AppText style={styles.error}>{message}</AppText> : null}
            <Pressable disabled={saveMutation.isPending} onPress={() => saveMutation.mutate()} style={[styles.save, { backgroundColor: theme.primary }, saveMutation.isPending && { opacity: 0.55 }]}>
              {saveMutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark" size={19} color="#FFFFFF" />}
              <AppText color="#FFFFFF" variant="label">{t("common.save")}</AppText>
            </Pressable>
          </GlassSurface>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(4,16,38,0.38)", alignItems: "center", justifyContent: "center", padding: 18 },
  wrap: { width: "100%", maxWidth: 480 },
  card: { borderRadius: 34, padding: 18, gap: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  close: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  preview: { alignItems: "center", paddingVertical: 4, gap: 8 },
  cropHint: { maxWidth: 300, textAlign: "center" },
  photoButton: { minHeight: 40, borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  removePhoto: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 5 },
  removePhotoText: { color: "#C33B4A", fontSize: 11, lineHeight: 14, fontWeight: "800" },
  field: { gap: 6 },
  countryOptions: { flexDirection: "row", gap: 7 },
  countryOption: { flex: 1, minWidth: 0, minHeight: 56, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 5 },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, fontSize: 15, fontWeight: "700" },
  save: { minHeight: 52, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  error: { color: "#DC2626", fontSize: 12, lineHeight: 16, fontWeight: "700" },
});
