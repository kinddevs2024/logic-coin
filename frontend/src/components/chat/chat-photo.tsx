import { useEffect, useState } from "react";
import { Image } from "react-native";

/** Preserve the original aspect ratio while keeping exceptionally tall images usable. */
export function ChatPhoto({uri}:{uri:string}) {
  const [ratio,setRatio]=useState(1);
  useEffect(()=>{let live=true;Image.getSize(uri,(width,height)=>{if(live&&width>0&&height>0)setRatio(width/height);},()=>{});return()=>{live=false;};},[uri]);
  return <Image source={{uri}} resizeMode="contain" style={{width:Math.min(320,420*ratio),maxWidth:"100%",aspectRatio:ratio,borderRadius:14}}/>;
}
