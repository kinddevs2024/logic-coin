import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useRaffle } from "./raffle-provider";
import { useTranslation } from "@/hooks/use-translation";
import { useAppTheme } from "@/hooks/use-app-theme";
import { raffleCopy } from "@/lib/raffle";
export function RaffleBanner() {
 const {state,now}=useRaffle();const {language}=useTranslation();const theme=useAppTheme();const router=useRouter();
 const event=state?.event;if(!event?.today)return null;const seconds=Math.max(0,Math.ceil((Date.parse(event.startsAt)-now)/1000));
 return <Pressable accessibilityRole="button" onPress={()=>router.push("/raffle" as never)} style={{padding:22,marginBottom:16,borderRadius:24,borderWidth:1,borderColor:theme.primary,backgroundColor:theme.surface}}>
  <Text style={{color:theme.primary,fontSize:13,fontWeight:"800"}}>{raffleCopy[language].today}</Text><Text style={{color:theme.text,fontSize:22,fontWeight:"800",marginTop:8}}>{event.title}</Text>
  <View style={{flexDirection:"row",justifyContent:"space-between",marginTop:12}}><Text style={{color:theme.textMuted}}>{seconds?raffleCopy[language].starts:raffleCopy[language].live}</Text><Text style={{color:theme.primary,fontSize:22,fontWeight:"900"}}>{seconds?`${String(Math.floor(seconds/3600)).padStart(2,"0")}:${String(Math.floor(seconds%3600/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`:"●"}</Text></View>
 </Pressable>;
}
