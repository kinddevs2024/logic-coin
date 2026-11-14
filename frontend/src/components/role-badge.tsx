import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { profileRolesApi } from "@/lib/api";
const labels: Record<string, string> = {manager: "Manager", admin: "Admin", owner: "Owner"};
const colors: Record<string, string> = {manager: "#226A9C", admin: "#6740A4", owner: "#8A5A13"};
export function RoleBadge({userId, role, compact = false}: {userId?: string; role?: string; compact?: boolean}) {
 const directory = useQuery({queryKey:["public-profile-roles"],queryFn:profileRolesApi,enabled:Boolean(userId),staleTime:60_000,retry:1});
 const value = userId && directory.data ? directory.data.roles[userId] : role;
 if (!value || !labels[value]) return null;
 return <View pointerEvents="none" style={{alignSelf:"center",borderRadius:6,paddingHorizontal:compact?3:6,paddingVertical:2,backgroundColor:colors[value]}}>
   <Text accessibilityLabel={`Роль: ${labels[value]}`} style={{color:"#fff",fontSize:compact?8:10,lineHeight:compact?10:13,fontWeight:"700"}}>{labels[value]}</Text>
 </View>;
}
