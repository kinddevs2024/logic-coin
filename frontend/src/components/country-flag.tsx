import {useState} from "react";
import {AppText} from "@/components/app-text";
import {useAppTheme} from "@/hooks/use-app-theme";
import {countryFlags} from "@/constants/country-flags";
import { Image, StyleSheet, View } from "react-native";
import {countryName} from "@/lib/country-options";
export {countryName,countryOptions,type CountryOption} from "@/lib/country-options";

export function CountryFlagBadge({countryCode,size=28}: {countryCode?:string|null;size?:number}) {
  const code = countryCode?.trim().toUpperCase();
  return code ? <FlagImage key={code} code={code} size={size}/> : null;
}
function FlagImage({code,size}: {code:string;size:number}) {
  const theme=useAppTheme();
  const [failed,setFailed]=useState(false);
  const source=countryFlags[code];
  return <View accessibilityLabel={countryName(code)} style={{height:size,width:Math.round(size*1.6),borderRadius:Math.max(2,Math.round(size*0.14)),overflow:"hidden",backgroundColor:theme.primarySoft,alignItems:"center",justifyContent:"center"}}>
    <AppText style={{fontSize:Math.max(8,size*0.42),lineHeight:size,color:theme.textMuted}}>{code}</AppText>
    {source && !failed ? <Image source={source} resizeMode="contain" onError={()=>setFailed(true)} style={[StyleSheet.absoluteFill, {width:Math.round(size*1.6),height:size}]}/> : null}
  </View>;
}

