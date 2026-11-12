import { useUiCopy } from "@/components/localized-native";

import { RoleBadge } from "@/components/role-badge";
import { useState } from "react";
import { Image, View } from "react-native";

import { AppText } from "@/components/app-text";
import { initials } from "@/lib/format";
import { useAppTheme } from "@/hooks/use-app-theme";
import { androidImageProps } from "@/lib/android-image";
import { migratedAppUrl } from "@/lib/server-migration";
import { avatarColor } from "@/lib/avatar-color";

export function Avatar({
  userId,
  name,
  avatarUrl,
  size = 44,
}: {
  userId?: string;
  name?: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const theme = useAppTheme();
  return (
    <View style={{width: size, height: size}}>
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: theme.mode === "dark" ? theme.surfaceMuted : "#E1EFE3",
      }}
    >
      <AvatarContent key={avatarUrl || "initials"} userId={userId} name={name} avatarUrl={avatarUrl} size={size} />
    </View>
    {userId ? <View pointerEvents="none" style={{position:"absolute",bottom:-3,left:-(Math.max(0,40-size)/2),right:-(Math.max(0,40-size)/2)}}><RoleBadge userId={userId} compact={size<64} /></View> : null}
    </View>
  );
}

function AvatarContent({ userId, name, avatarUrl, size }: { userId?: string; name?: string; avatarUrl?: string | null; size: number }) {
  const { copyText } = useUiCopy();
  const color = avatarColor(userId || "guest");
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <Image
        {...androidImageProps}
        accessibilityLabel={copyText(name ? `Фото ${name}` : "Фото профиля")}
        source={{ uri: migratedAppUrl(avatarUrl) }}
        style={{ flex: 1, width: "100%", borderRadius: size / 2 }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{
        flex: 1,
        borderRadius: size / 2,
        backgroundColor: color.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText variant={size > 64 ? "heading" : "label"} color={color.foreground} style={{ fontSize: size * 0.32 }}>
        {initials(name)}
      </AppText>
    </View>
  );
}
