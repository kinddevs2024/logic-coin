import { View } from "react-native";
import { useRouter } from "expo-router";
import { useRaffle } from "@/components/raffle-provider";
import { RaffleStage } from "@/components/raffle-stage";
import { AppButton } from "@/components/buttons";
import { AppText } from "@/components/app-text";
import { useTranslation } from "@/hooks/use-translation";
import { raffleCopy } from "@/lib/raffle";
export default function RaffleScreen(){const {state,now,eligibleDays}=useRaffle();const {language}=useTranslation();const router=useRouter();return state?.event ? <RaffleStage event={state.event} now={now} eligibleDays={eligibleDays}/> : <View style={{flex:1,justifyContent:"center",padding:28,gap:20}}><AppText>{raffleCopy[language].none}</AppText><AppButton onPress={()=>router.replace("/(tabs)")}>{language==="ru"?"На главную":language==="uz"?"Bosh sahifa":"Home"}</AppButton></View>;}
