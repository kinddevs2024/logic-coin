import {useMemo, type PropsWithChildren} from "react";
import {AppThemeOverride,useAppTheme} from "@/hooks/use-app-theme";
import {appearanceTheme} from "@/lib/appearance-theme";
import type {ChatRoom} from "@/lib/chat-api";
export function ChatThemeProvider({appearance,children}:PropsWithChildren<{appearance?:ChatRoom["chatTheme"]}>) {
 const base=useAppTheme();
 const theme=useMemo(()=>!appearance || appearance.preset === "system" ? base : appearanceTheme(base,appearance.preset,appearance),[base,appearance]);
 return <AppThemeOverride.Provider value={theme}>{children}</AppThemeOverride.Provider>;
}
