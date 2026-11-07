import { useIsFocused } from "expo-router";
import { useEffect, useState, type ComponentType } from "react";
import { View } from "react-native";
import { isExpoGo } from "@/lib/native-runtime";
import { AppText } from "./app-text";
import { useUiCopy } from "./localized-native";
// Older installed APKs may lack the advertising bridge. Resolve it only when
// visible, and keep the screen usable if the SDK or consent is unavailable.
export function FeedAd({placement,visible=true}:{placement:string;visible?:boolean}) {
 const focused=useIsFocused(),{copyText}=useUiCopy();
 const [Banner,setBanner]=useState<ComponentType|null>(null);
 useEffect(()=>{
  let active=true;
  if(!focused || !visible || isExpoGo)return;
  void (async()=>{try{
   const {admob}=require("@/lib/admob");
   if(await admob.initialize()){
    const component=require("./admob-banner.native").AdmobBannerSlot as ComponentType;
    if(active)setBanner(()=>component);
   }
  }catch{/* A missing native module must not break OTA-compatible APKs. */}})();
  return ()=>{active=false;};
 },[focused,visible]);
 if(!visible || !focused || !Banner)return null;
 return <View testID={`feed-ad-${placement}`} style={{width:"100%",marginVertical:14,alignItems:"center",gap:5}}><AppText variant="caption" muted>{copyText("Реклама")}</AppText><Banner/></View>;
}
