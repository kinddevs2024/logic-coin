import { Linking, Pressable, UIManager, View, Image } from "react-native";
import { useMemo, useState } from "react";
import { AppText } from "@/components/app-text";
import Ionicons from "@expo/vector-icons/Ionicons";
let WebView: typeof import("react-native-webview").WebView | null = null;
try { if(UIManager.getViewManagerConfig("RNCWebView")) WebView=require("react-native-webview").WebView; } catch { /* Keep old APKs without WebView usable. */ }
export function VideoPlayer({url,name}:{url:string;name:string}) {
  const [started,setStarted] = useState(false);
  const posterSource = useMemo(() => ({uri:`${url}${url.includes("?") ? "&" : "?"}poster=1`}), [url]);
  if(!started || !WebView) return <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={event=>{event.stopPropagation();if(WebView)setStarted(true);else void Linking.openURL(url).catch(()=>{});}} style={{width:320,maxWidth:"100%",aspectRatio:16/9,alignItems:"center",justifyContent:"center",backgroundColor:"#111",borderRadius:12,overflow:"hidden"}}>
    <Image source={posterSource} resizeMode="contain" style={{position:"absolute",width:"100%",height:"100%"}} />
    <Ionicons name="play-circle" size={58} color="#fff"/>
    {!WebView ? <AppText color="#fff" numberOfLines={1}>{name}</AppText> : null}
  </Pressable>;
  const safe=url.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
  const origin=new URL(url).origin;
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#000;height:100vh"><video controls autoplay playsinline preload="metadata" onloadedmetadata="if(this.duration>0.05)this.currentTime=0.05" src="${safe}" style="width:100%;height:100%;object-fit:contain"></video></body></html>`;
  return <View style={{width:320,maxWidth:"100%",aspectRatio:16/9,borderRadius:12,overflow:"hidden",backgroundColor:"#000"}}>
    <WebView source={{html,baseUrl:origin}} originWhitelist={["https://*"]} javaScriptEnabled mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback allowsFullscreenVideo setSupportMultipleWindows={false} onShouldStartLoadWithRequest={request=>request.url==="about:blank" || request.url.startsWith(origin+"/")} style={{backgroundColor:"#000"}} />
  </View>;
}
