import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInUp, FadeOut } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { CountryFlagBadge, countryName, countryOptions } from "@/components/country-flag";
import { GlassSurface } from "@/components/glass-surface";
import { PhotoCropEditor } from "@/components/photo-crop-editor";
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
  const [countryQuery, setCountryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [picking, setPicking] = useState(false);
  const [cropAsset, setCropAsset] = useState<{ uri: string; width: number; height: number; mimeType: string } | null>(null);
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
        allowsEditing: false,
        quality: 1,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = asset?.mimeType?.toLowerCase() ?? "image/jpeg";
      if (!asset?.base64 || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        setMessage("Выберите JPG, PNG или WebP");
        return;
      }
      setCropAsset({ uri: asset.uri, width: asset.width, height: asset.height, mimeType });
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
    <>
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
            </View>
            <View style={styles.field}>
              <AppText variant="caption" muted>{t("profile.name")}</AppText>
              <TextInput value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" placeholder={t("profile.name")} placeholderTextColor={String(theme.textMuted)} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]} />
            </View>
            <View style={styles.field}>
              <AppText variant="caption" muted>Страна</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: countryOpen }}
                onPress={() => setCountryOpen((open) => !open)}
                style={[styles.countryPicker, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
              >
                <CountryFlagBadge countryCode={countryCode} size={22} />
                <AppText style={styles.countryPickerText} numberOfLines={1}>{countryName(countryCode, language)}</AppText>
                <Ionicons name={countryOpen ? "chevron-up" : "chevron-down"} size={18} color={String(theme.textMuted)} />
              </Pressable>
              {countryOpen ? (
                <>
                  <TextInput
                    value={countryQuery}
                    onChangeText={setCountryQuery}
                    autoFocus
                    placeholder="Поиск страны"
                    placeholderTextColor={String(theme.textMuted)}
                    style={[styles.countrySearch, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
                  />
                  <ScrollView style={styles.countryScroll} contentContainerStyle={styles.countryOptions} nestedScrollEnabled showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
                    {countryOptions(language)
                      .filter(({ name, code }) => !countryQuery.trim() || `${name} ${code}`.toLocaleLowerCase().includes(countryQuery.trim().toLocaleLowerCase()))
                      .map(({ code }) => (
                        <Pressable key={code} accessibilityRole="radio" accessibilityState={{ checked: countryCode === code }} onPress={() => { setCountryCode(code); setCountryOpen(false); setCountryQuery(""); }} style={[styles.countryOption, { borderColor: countryCode === code ? theme.primary : theme.border, backgroundColor: countryCode === code ? theme.primarySoft : theme.surfaceRaised }]}>
                          <CountryFlagBadge countryCode={code} size={22} />
                          <AppText variant="caption" numberOfLines={1}>{countryName(code, language)}</AppText>
                        </Pressable>
                      ))}
                  </ScrollView>
                </>
              ) : null}
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
    <PhotoCropEditor
      asset={cropAsset}
      onCancel={() => setCropAsset(null)}
      onConfirm={(dataUrl) => { setAvatarDataUrl(dataUrl); setCropAsset(null); }}
    />
    </>
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
  photoButton: { minHeight: 40, borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  field: { gap: 6 },
  countrySearch: { minHeight: 44, borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, fontSize: 14, fontWeight: "600" },
  countryScroll: { maxHeight: 260 },
  countryPicker: { minHeight: 52, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10 },
  countryPickerText: { flex: 1, fontSize: 14, fontWeight: "700" },
  countryOptions: { gap: 7, paddingVertical: 1 },
  countryOption: { width: "100%", minHeight: 52, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10 },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, paddingHorizontal: 15, fontSize: 15, fontWeight: "700" },
  save: { minHeight: 52, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  error: { color: "#DC2626", fontSize: 12, lineHeight: 16, fontWeight: "700" },
});
