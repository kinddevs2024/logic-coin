import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { CountryFlagBadge, countryName } from "@/components/country-flag";
import { GlassSurface } from "@/components/glass-surface";
import { publicProfileApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AppButton } from "@/components/buttons";
import { sharePublicProfile } from "@/lib/profile-link";
import { cosmeticsFor } from "@/games/cosmetics";
import type { GameId } from "@/games/progress-store";

export default function PublicProfileScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const query = useQuery({
    queryKey: ["public-profile", code],
    queryFn: () => publicProfileApi.get(code ?? ""),
    enabled: Boolean(code),
  });
  const profile = query.data?.profile;
  const openApp = () => {
    if (Platform.OS !== "web" || !code || !/Android/i.test(navigator.userAgent)) return;
    const fallback = `https://www.logic-coin.online/profile/${encodeURIComponent(code)}?web=1`;
    window.location.assign(`intent://profile/${encodeURIComponent(code)}#Intent;scheme=logiccoin;package=com.kinddevs.logiccoin;S.browser_fallback_url=${encodeURIComponent(fallback)};end`);
  };
  useEffect(() => {
    if (Platform.OS !== "web" || !code || !/Android/i.test(navigator.userAgent) || new URLSearchParams(window.location.search).has("web")) return;
    const fallback = `https://www.logic-coin.online/profile/${encodeURIComponent(code)}?web=1`;
    window.location.replace(`intent://profile/${encodeURIComponent(code)}#Intent;scheme=logiccoin;package=com.kinddevs.logiccoin;S.browser_fallback_url=${encodeURIComponent(fallback)};end`);
  }, [code]);

  return (
    <AppFrame wide>
      {Platform.OS === "web" && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) ? <AppButton onPress={openApp}>Открыть в приложении</AppButton> : null}
      {query.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
      {query.error ? <AppText color={String(theme.danger)}>Профиль не найден</AppText> : null}
      {profile ? <>
        <GlassSurface variant="strong" intensity={82} style={styles.hero}>
          <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={92} />
          <AppText variant="title">{profile.name}</AppText>
          <View style={styles.countryLine}><CountryFlagBadge countryCode={profile.countryCode} size={19} /><AppText muted>{countryName(profile.countryCode)}</AppText></View>
        </GlassSurface>
        <View style={styles.grid}>
          <Stat icon="wallet-outline" label="Баланс" value={formatMoney(profile.balanceUnits)} />
          <Stat icon="diamond-outline" label="Монеты" value={String(profile.coinBalance)} />
          <Stat icon="trophy-outline" label="Выиграно" value={formatMoney(profile.lifetimeEarnedUnits)} />
          <Stat icon="flash-outline" label="Челленджей" value={String(profile.completedChallenges)} />
        </View>
        <GlassSurface variant="soft" intensity={58} style={styles.skinBlock}>
          <AppText variant="heading">Скины игр</AppText>
          {profile.skins.length ? <View style={styles.skinsRow}>{profile.skins.map(key => {
            const [gameId, skinId] = key.split(":");
            const skin = cosmeticsFor(gameId as GameId).find(item => item.id === skinId);
            return <View key={key} accessible accessibilityLabel={skin ? `${skin.name} — ${gameId}` : "Скин игры"} style={[styles.skinIcon, { backgroundColor: skin?.secondary ?? theme.primarySoft }]}>
              <MaterialCommunityIcons name={skin?.icon ?? "tshirt-crew-outline"} size={23} color={skin?.primary ?? String(theme.primary)} />
            </View>;
          })}</View> : <AppText muted>Пока нет купленных скинов</AppText>}
        </GlassSurface>
        <AppButton icon="share-outline" onPress={() => void sharePublicProfile(profile.name, profile.referralCode)}>Поделиться профилем</AppButton>
      </> : null}
    </AppFrame>
  );
}

function Stat({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  const theme = useAppTheme();
  return <GlassSurface variant="soft" intensity={58} style={styles.stat}><Ionicons name={icon} size={20} color={String(theme.primary)} /><AppText variant="heading">{value}</AppText><AppText variant="caption" muted>{label}</AppText></GlassSurface>;
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 7, padding: 24, borderRadius: 28 },
  countryLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  stat: { flexGrow: 1, flexBasis: "45%", minHeight: 110, alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 22 },
  skinBlock: { marginTop: 14, marginBottom: 16, gap: 10, padding: 18, borderRadius: 22 },
  skinsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skinIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
