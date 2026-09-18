import { useState } from "react";
import { Image, View } from "react-native";

import { AppText } from "@/components/app-text";
import { initials } from "@/lib/format";
import { useAppTheme } from "@/hooks/use-app-theme";

export function Avatar({
  name,
  avatarUrl,
  size = 44,
}: {
  name?: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: theme.mode === "dark" ? theme.surfaceMuted : "#E9EDF4",
      }}
    >
      <AvatarContent key={avatarUrl || "initials"} name={name} avatarUrl={avatarUrl} size={size} />
    </View>
  );
}

function AvatarContent({ name, avatarUrl, size }: { name?: string; avatarUrl?: string | null; size: number }) {
  const theme = useAppTheme();
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <Image
        accessibilityLabel={name ? `Фото ${name}` : "Фото профиля"}
        source={{ uri: avatarUrl }}
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
        backgroundColor: theme.mode === "dark" ? theme.primarySoft : "#E9EDF4",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText variant={size > 64 ? "heading" : "label"} color={theme.mode === "dark" ? String(theme.primary) : "#34415A"} style={{ fontSize: size * 0.32 }}>
        {initials(name)}
      </AppText>
    </View>
  );
}
