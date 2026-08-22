import { useState } from "react";
import { Image, View } from "react-native";

import { AppText } from "@/components/app-text";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  avatarUrl,
  size = 44,
}: {
  name?: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: "#E9EDF4",
      }}
    >
      <AvatarContent key={avatarUrl || "initials"} name={name} avatarUrl={avatarUrl} size={size} />
    </View>
  );
}

function AvatarContent({ name, avatarUrl, size }: { name?: string; avatarUrl?: string | null; size: number }) {
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
        backgroundColor: "#E9EDF4",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText variant={size > 64 ? "heading" : "label"} color="#34415A" style={{ fontSize: size * 0.32 }}>
        {initials(name)}
      </AppText>
    </View>
  );
}
