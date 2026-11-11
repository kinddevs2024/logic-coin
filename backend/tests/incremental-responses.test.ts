import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { incrementalResponses } from "../src/middleware/incremental-responses.js";
let server: Server, base: string, value = 10, calls = 0;
beforeAll(async () => {
  const app = express();
  app.use((req, res, next) => {
    if (!req.headers.authorization || req.headers.authorization === "revoked") { res.status(401).json({ error: "unauthorized" }); return; }
    req.auth = { userId: req.headers.authorization, sessionId: "test" } as any; next();
  });
  app.use(incrementalResponses);
  app.get(["/wallet", "/home", "/chat/", "/chat/abc/messages"], (req, res) => { calls++;res.setHeader("Cache-Control", "no-store");res.json({data:{value,...(req.path==="/home"?{serverNow:new Date().toISOString()}: {})}}); });
  app.post("/wallet", (_req,res) => res.json({data:{value}}));
  server=createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");base=`http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
beforeEach(()=>{value=10;calls=0});
const get=(path="/wallet",extra:Record<string,string>={})=>fetch(base+path,{headers:{authorization:"alice","X-Data-Cache-Version":"1","Accept-Language":"uz",...extra}});
it("unchanged resources send no body, but still run authorized validation",async()=>{
 const first=await get();const tag=first.headers.get("etag")!;expect(await first.json()).toEqual({data:{value:10}});
 const same=await get("/wallet",{"If-None-Match":tag});expect(same.status).toBe(304);expect(await same.text()).toBe("");expect(calls).toBe(2);
 value=11;const changed=await get("/wallet",{"If-None-Match":tag});expect(changed.status).toBe(200);expect(await changed.json()).toEqual({data:{value:11}});
});
it("keeps clock synchronization without downloading an unchanged home",async()=>{
 const first=await get("/home");await first.text();const second=await get("/home",{"If-None-Match":first.headers.get("etag")!});expect(second.status).toBe(304);expect(Number.isFinite(Date.parse(second.headers.get("X-Server-Time")!))).toBe(true);
});
it("scopes validators to account and language and never bypasses revoked authentication",async()=>{
 const first=await get();await first.text();const tag=first.headers.get("etag")!;
 expect((await get("/wallet",{"If-None-Match":tag,authorization:"bob"})).status).toBe(200);
 expect((await get("/wallet",{"If-None-Match":tag,"Accept-Language":"ru"})).status).toBe(200);
 expect((await get("/wallet",{"If-None-Match":tag,authorization:"revoked"})).status).toBe(401);
});
it("leaves legacy clients and mutations unchanged",async()=>{
 const old=await get("/wallet",{"X-Data-Cache-Version":""});expect(old.headers.get("cache-control")).toBe("no-store");expect(old.headers.has("X-Data-Cache-Version")).toBe(false);
 const post=await fetch(base+"/wallet",{method:"POST",headers:{authorization:"alice","X-Data-Cache-Version":"1"}});expect(post.status).toBe(200);expect(post.headers.has("X-Data-Cache-Version")).toBe(false);
});
it.each(["/chat/","/chat/abc/messages"])("revalidates actual chat route %s",async path=>{
 const first=await get(path);await first.text();const next=await get(path,{"If-None-Match":first.headers.get("etag")!});expect(next.status).toBe(304);
});
