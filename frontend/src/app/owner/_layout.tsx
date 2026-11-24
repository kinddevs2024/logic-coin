import { Redirect, Slot, usePathname, useRouter } from "expo-router";
import { ActivityIndicator, Linking, Platform, Pressable, View } from "react-native";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";
export default function OwnerLayout() {
 const hydrated=useAppStore(s=>s.hydrated), token=useAppStore(s=>s.accessToken), role=useAppStore(s=>s.user.role), router=useRouter(), theme=useAppTheme(), pathname=usePathname();
 if(!hydrated)return <ActivityIndicator />;
 if(!token)return <Redirect href={{pathname:"/login",params:{next:"/owner"}}}/>;
 if(role!=="owner")return <Redirect href="/(tabs)"/>;
 return <AppFrame wide contentStyle={{maxWidth:1320,gap:20}}><View style={{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:16}}><View style={{flex:1,minWidth:220}}><AppText variant="title">Logic Coin · Owner</AppText><AppText muted>Отчёты и управление выводами</AppText></View><Pressable accessibilityRole="link" onPress={()=>{if(Platform.OS === "web")router.push("/admin" as never);else void Linking.openURL("https://logic-coin.online/admin");}} style={{padding:14,borderRadius:16,backgroundColor:theme.primarySoft}}><AppText>Администрация</AppText></Pressable><Pressable accessibilityRole="link" onPress={()=>router.push("/messages")} style={{padding:14,borderRadius:16,backgroundColor:theme.primarySoft}}><AppText>Переписка</AppText></Pressable><Pressable accessibilityRole="link" onPress={()=>router.replace("/(tabs)")} style={{padding:14}}><AppText>В приложение</AppText></Pressable></View><View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{[["/owner","Все разделы"],["/owner/overview","Обзор"],["/owner/finance","Финансы"],["/owner/credits","Денежные начисления"],["/owner/withdrawals","Выводы"],["/owner/challenges","Челленджи"],["/owner/prizes","Призы"],["/owner/rating","Рейтинг"]].map(([href,label])=><Pressable key={href} accessibilityRole="link" onPress={()=>router.push(href as never)} style={{paddingVertical:10,paddingHorizontal:12,borderRadius:12,backgroundColor:pathname===href?theme.primarySoft:theme.surface}}><AppText>{label}</AppText></Pressable>)}</View><Slot/></AppFrame>;
}
