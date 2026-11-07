import { createElement } from "react";
import { View } from "react-native";
export function VideoPlayer({url,name}:{url:string;name:string}) {
  return <View style={{width:320,maxWidth:"100%",aspectRatio:16/9,borderRadius:12,overflow:"hidden",backgroundColor:"#000"}}>
    {createElement("video", {
      src:url, poster:`${url}${url.includes("?") ? "&" : "?"}poster=1`, controls:true, playsInline:true, preload:"metadata", "aria-label":name,
      style:{width:"100%",height:"100%",objectFit:"contain",display:"block"},
      onClick:(event:{stopPropagation:()=>void})=>event.stopPropagation(),
      onLoadedMetadata:(event:{currentTarget:HTMLVideoElement})=>{ const video=event.currentTarget;if(video.currentTime===0 && video.duration>0.05)video.currentTime=0.05; },
    })}
  </View>;
}
