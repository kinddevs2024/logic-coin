import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { IncrementalCache, revalidatedBody, cacheableRead } from "../src/lib/incremental-cache";
import { snapshotQueries, restoreQueries } from "../src/lib/query-snapshots";
function storage(){const values=new Map<string,string>();return {values,getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v)},removeItem:async(k:string)=>{values.delete(k)}}}
it("restores a cold launch, deletes another account/language and does not resurrect in-flight data after logout",async()=>{
 const s=storage();const a=new IncrementalCache(s);await a.open("alice:uz");const gen=a.generation;a.put("/chat/",{body:{data:{chats:[1]}},etag:'W/"1"',savedAt:Date.now()},gen);await a.flush();
 const b=new IncrementalCache(s);await b.open("alice:uz");expect(b.get("/chat/")?.body).toEqual({data:{chats:[1]}});
 await b.open("alice:ru");expect(b.get("/chat/")).toBeUndefined();expect(s.values.size).toBe(0);
 await a.open(null);a.put("/chat/",{body:{secret:1},etag:'W/"1"',savedAt:Date.now()},gen);await a.flush();expect(s.values.size).toBe(0);
});
it("tolerates damaged/full storage and bounds persisted data",async()=>{
 const s=storage();s.values.set("logiccoin-data-cache-v1","broken");const cache=new IncrementalCache(s);await cache.open("alice");expect(cache.ready).toBe(true);
 for(let i=0;i<50;i++)cache.put(`/chat/${i}/messages`,{body:"x".repeat(25_000),etag:String(i),savedAt:Date.now()},cache.generation);
 cache.setQueries(Array.from({length:40},()=>({state:"x".repeat(25_000)})));await cache.flush();expect([...s.values.values()][0].length).toBeLessThan(351_000);
 const failing=new IncrementalCache({...s,setItem:async()=>{throw Error("full")}});await failing.open("alice");failing.setQueries([{}]);await expect(failing.flush()).resolves.toBeUndefined();
});
it("expires snapshots and refreshes only clock fields on 304",async()=>{
 let now=1000;const s=storage();const a=new IncrementalCache(s,()=>now);await a.open("alice");a.put("/home",{body:{},etag:"1",savedAt:now},a.generation);await a.flush();now+=8*86400000;await a.open("alice");expect(a.get("/home")).toBeUndefined();
 expect(revalidatedBody({data:{serverNow:"old",value:1}},"2026-11-11T00:00:00Z")).toEqual({data:{serverNow:"2026-11-11T00:00:00Z",value:1}});
 expect(cacheableRead("/auth/refresh")).toBe(false);expect(cacheableRead("/admin/users")).toBe(false);expect(cacheableRead("/withdrawals")).toBe(false);
});
it("restores visible data with a rotated token, revalidates Infinity queries and excludes old days, admin results and mutations",()=>{
 const a=new QueryClient();a.setQueryData(["bootstrap","secret-token"],{user:{id:"alice"}});a.setQueryData(["challenges","today","secret-token"],{dayKey:"2026-11-10",endsAt:"2026-11-11T00:00:00Z"});a.setQueryData(["admin","users"],[{private:true}]);
 const saved=snapshotQueries(a,new Set(["secret-token"]));expect(JSON.stringify(saved)).not.toContain("secret-token");expect(saved).toHaveLength(2);
 const b=new QueryClient();restoreQueries(b,JSON.parse(JSON.stringify(saved)),"new-token",Date.parse("2026-11-11T00:01:00Z"));expect(b.getQueryData(["bootstrap","new-token"])).toEqual({user:{id:"alice"}});expect(b.getQueryState(["bootstrap","new-token"])?.isInvalidated).toBe(true);expect(b.getQueryData(["challenges","today","new-token"])).toBeUndefined();a.clear();b.clear();
});
it("keeps the last successful snapshot after an offline background refresh",async()=>{
 const client=new QueryClient();client.setQueryData(["chat-list","token"],{chats:[{id:1}]});
 await client.fetchQuery({queryKey:["chat-list","token"],queryFn:async()=>{throw Error("offline")},retry:false}).catch(()=>{});
 expect(client.getQueryState(["chat-list","token"])?.status).toBe("error");
 const saved=snapshotQueries(client,new Set(["token"]));const restarted=new QueryClient();restoreQueries(restarted,saved,"new-token");expect(restarted.getQueryData(["chat-list","new-token"])).toEqual({chats:[{id:1}]});client.clear();restarted.clear();
});
