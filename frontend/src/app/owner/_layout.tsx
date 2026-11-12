import { Redirect, Slot, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";
export default function OwnerLayout() {
 const hydrated=useAppStore(s=>s.hydrated), token=useAppStore(s=>s.accessToken), role=useAppStore(s=>s.user.role), router=useRouter(), theme=useAppTheme();
 if(!hydrated)return <ActivityIndicator />;
 if(!token)return <Redirect href={{pathname:"/login",params:{next:"/owner"}}}/>;
 if(role!=="owner"&&role!=="admin")return <Redirect href="/(tabs)"/>;
 return <AppFrame wide contentStyle={{maxWidth:1320,gap:20}}><View style={{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:16}}><View style={{flex:1,minWidth:220}}><AppText variant="title">Logic Coin · Owner</AppText><AppText muted>Статистика и финансы · Только просмотр</AppText></View><Pressable accessibilityRole="link" onPress={()=>router.push("/messages")} style={{padding:14,borderRadius:16,backgroundColor:theme.primarySoft}}><AppText>Переписка</AppText></Pressable><Pressable accessibilityRole="link" onPress={()=>router.replace("/(tabs)")} style={{padding:14}}><AppText>В приложение</AppText></Pressable></View><Slot/></AppFrame>;
}
