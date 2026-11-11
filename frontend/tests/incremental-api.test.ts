import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f=vi.hoisted(()=>({state:{user:{id:"alice"},language:"uz",accessToken:"token-a",refreshToken:null},storage:new Map<string,string>()}));
vi.mock("react-native",()=>({Platform:{OS:"android"}}));
vi.mock("@/store/app-store",()=>({useAppStore:{getState:()=>f.state}}));
vi.mock("@/lib/device-id",()=>({getDeviceId:async()=>"device"}));
vi.mock("../src/lib/referral-attribution",()=>({registrationReferralCode:async()=>null}));
vi.mock("../src/lib/telegram-context",()=>({telegramChallengeInitData:()=>undefined}));
vi.mock("@react-native-async-storage/async-storage",()=>({default:{getItem:async(k:string)=>f.storage.get(k)??null,setItem:async(k:string,v:string)=>{f.storage.set(k,v)},removeItem:async(k:string)=>{f.storage.delete(k)}}}));
import { request, API_URL } from "../src/lib/api";
import { nativeDataCache, dataCacheScope } from "../src/lib/native-data-cache";
beforeEach(async()=>{f.storage.clear();f.state.accessToken="token-a";await nativeDataCache.open(dataCacheScope(API_URL,"alice","uz"))});
afterEach(async()=>{await nativeDataCache.open(null);vi.unstubAllGlobals()});
const json=(data:unknown,tag='W/"1"')=>new Response(JSON.stringify({data}),{status:200,headers:{ETag:tag,"X-Data-Cache-Version":"1"}});
it("cold launches and token rotations reuse cached bytes on 304, then apply only changed data",async()=>{
 const network=vi.fn().mockResolvedValueOnce(json({value:1})).mockResolvedValueOnce(new Response(null,{status:304,headers:{"X-Data-Cache-Version":"1"}})).mockResolvedValueOnce(json({value:2},'W/"2"'));vi.stubGlobal("fetch",network);
 expect(await request("/wallet",{token:"token-a"})).toEqual({value:1});await nativeDataCache.flush();await nativeDataCache.open(dataCacheScope(API_URL,"alice","uz"));f.state.accessToken="rotated";
 expect(await request("/wallet",{token:"rotated"})).toEqual({value:1});expect((network.mock.calls[1][1].headers as Headers).get("If-None-Match")).toBe('W/"1"');expect((network.mock.calls[1][1].headers as Headers).get("Authorization")).toBe("Bearer rotated");
 expect(await request("/wallet",{token:"rotated"})).toEqual({value:2});
});
it("never substitutes old data for an authorization or network error",async()=>{
 const network=vi.fn().mockResolvedValueOnce(json({value:1})).mockResolvedValueOnce(new Response(JSON.stringify({error:{message:"denied"}}),{status:401})).mockRejectedValueOnce(Error("offline"));vi.stubGlobal("fetch",network);
 await request("/wallet",{token:"token-a"});await expect(request("/wallet",{token:"token-a",skipAuthRefresh:true})).rejects.toMatchObject({status:401});await expect(request("/wallet",{token:"token-a"})).rejects.toMatchObject({code:"network_unavailable"});
});
it("ignores in-flight responses when the account changes",async()=>{
 let finish!:(r:Response)=>void;vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(r=>{finish=r})));
 const pending=request("/chat/",{token:"token-a"});await nativeDataCache.open(dataCacheScope(API_URL,"bob","uz"));finish(json({chats:["alice-private"]}));await expect(pending).rejects.toMatchObject({name:"AbortError"});expect(nativeDataCache.get("/chat/")).toBeUndefined();
});
it("does not send validators for mutations and retries unexpected 304 without local data",async()=>{
 const network=vi.fn().mockResolvedValueOnce(json({value:1})).mockResolvedValueOnce(json({ok:true})).mockResolvedValueOnce(new Response(null,{status:304})).mockResolvedValueOnce(json({chats:[]}));vi.stubGlobal("fetch",network);
 await request("/wallet",{token:"token-a"});await request("/wallet",{token:"token-a",method:"POST",body:"{}"});expect(network.mock.calls[1][1].headers.has("If-None-Match")).toBe(false);
 expect(await request("/chat/",{token:"token-a"})).toEqual({chats:[]});expect(network).toHaveBeenCalledTimes(4);
});
