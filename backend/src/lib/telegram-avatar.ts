import sharp from "sharp";
export function isTelegramAvatar(value:string):boolean{
 try{const u=new URL(value);return u.protocol==="https:"&&u.hostname==="t.me"&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/i\/userpic\/[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp|svg)$/i.test(u.pathname);}catch{return false;}
}
export function isAvatarRedirect(value:string):boolean{
 if(isTelegramAvatar(value))return true;
 try{const u=new URL(value);return u.protocol==="https:"&&/^cdn\d{1,2}\.telesco\.pe$/.test(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.hash&&u.pathname.startsWith("/file/");}catch{return false;}
}
export async function renderTelegramAvatar(value:string):Promise<Buffer>{
 if(!isTelegramAvatar(value))throw Error("Unsupported remote avatar");
 let target=value,response!:Response;const signal=AbortSignal.timeout(7000);
 for(let redirects=0;redirects<4;redirects++){
  response=await fetch(target,{redirect:"manual",signal});
  if(![301,302,303,307,308].includes(response.status))break;
  const location=response.headers.get("location");await response.body?.cancel();
  if(!location)throw Error("Missing avatar redirect");
  const next=new URL(location,target).href;if(!isAvatarRedirect(next))throw Error("Unsupported avatar redirect");target=next;
 }
 if(!response.ok||!/^image\/(?:jpeg|png|webp|svg\+xml)(?:;|$)/i.test(response.headers.get("content-type")??""))throw Error("Avatar unavailable");
 const limit=5_000_000;if(Number(response.headers.get("content-length"))>limit)throw Error("Avatar too large");
 const reader=response.body?.getReader();if(!reader)throw Error("Empty avatar");const parts:Buffer[]=[];let size=0;
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>limit)throw Error("Avatar too large");parts.push(Buffer.from(chunk.value));}}finally{await reader.cancel().catch(()=>{});}
 return sharp(Buffer.concat(parts),{limitInputPixels:20_000_000,animated:false}).rotate().resize(160,160,{fit:"cover",withoutEnlargement:true}).webp({quality:76}).toBuffer();
}
