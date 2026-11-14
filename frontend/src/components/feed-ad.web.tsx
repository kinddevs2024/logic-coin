import { useIsFocused } from "expo-router";
import { View } from "react-native";
import { DisplayAd } from "./home-desktop-ads.web";
import { isTelegramMiniApp } from "@/lib/telegram-context";
const slots: Record<string,string> = { "games-catalog":"5234789961", "leaderboard":"8329614753", "challenge-history":"3467995303", "invite-friends":"5234789961", "official-news":"8329614753" };
export function FeedAd({placement,visible=true}:{placement:string;visible?:boolean}) {
 const focused=useIsFocused();
 if(!visible || !focused || !slots[placement] || isTelegramMiniApp())return null;
 return <View testID={`feed-ad-${placement}`} style={{width:"100%",minWidth:0,marginVertical:14}}><DisplayAd slot={slots[placement]} horizontal focused={focused}/></View>;
}
