import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { publicProfileApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AppButton } from "@/components/buttons";
import { sharePublicProfile } from "@/lib/profile-link";

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

  return (
    <AppFrame wide>
      {query.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
      {query.error ? <AppText color={String(theme.danger)}>Профиль не найден</AppText> : null}
      {profile ? <>
        <GlassSurface variant="strong" intensity={82} style={styles.hero}>
          <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={92} />
          <AppText variant="title">{profile.name}</AppText>
          <AppText muted>Публичный профиль · {profile.referralCode}</AppText>
        </GlassSurface>
        <View style={styles.grid}>
          <Stat icon="wallet-outline" label="Баланс" value={formatMoney(profile.balanceUnits)} />
          <Stat icon="diamond-outline" label="Монеты" value={String(profile.coinBalance)} />
          <Stat icon="trophy-outline" label="Выиграно" value={formatMoney(profile.lifetimeEarnedUnits)} />
          <Stat icon="flash-outline" label="Челленджей" value={String(profile.completedChallenges)} />
        </View>
        <GlassSurface variant="soft" intensity={58} style={styles.skinBlock}>
          <AppText variant="heading">Скины игр</AppText>
          <AppText muted>{profile.skins.length ? profile.skins.join(", ") : "Пока нет купленных скинов"}</AppText>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  stat: { flexGrow: 1, flexBasis: "45%", minHeight: 110, alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 22 },
  skinBlock: { marginTop: 14, gap: 7, padding: 18, borderRadius: 22 },
});
