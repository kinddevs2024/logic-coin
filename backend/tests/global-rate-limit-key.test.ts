import {expect,it} from "vitest";
import jwt from "jsonwebtoken";
import type {Request} from "express";
import {env} from "../src/config/env.js";
import {globalRateLimitKey} from "../src/lib/global-rate-limit-key.js";
const first="111111111111111111111111",second="222222222222222222222222",sid="333333333333333333333333";
const token=(sub:string,expiresIn=900)=>jwt.sign({sub,sid,type:"access"},env.JWT_SECRET,{algorithm:"HS256",issuer:env.JWT_ISSUER,audience:env.JWT_AUDIENCE,expiresIn});
const req=(authorization?:string,ip="203.0.113.7")=>({ip,socket:{remoteAddress:ip},header:(key:string)=>key==="authorization"?authorization:undefined}) as unknown as Request;
it("separates real accounts sharing an IP but keeps rotated sessions in one quota",()=>{
 expect(globalRateLimitKey(req(`Bearer ${token(first)}`))).toBe(`account:${first}`);
 expect(globalRateLimitKey(req(`Bearer ${token(second)}`))).toBe(`account:${second}`);
 expect(globalRateLimitKey(req(`Bearer ${token(first)}`,"203.0.113.9"))).toBe(`account:${first}`);
});
it("does not let arbitrary, forged or expired bearer tokens bypass the IP quota",()=>{
 const fallback=globalRateLimitKey(req());
 for(const t of ["fake",token(first,-1),token(first)+"x"])expect(globalRateLimitKey(req(`Bearer ${t}`))).toBe(fallback);
});
it("normalizes IPv6 clients into the library subnet key",()=>{
 expect(globalRateLimitKey(req(undefined,"2001:db8:1234:5600::1"))).toBe(globalRateLimitKey(req(undefined,"2001:db8:1234:5600::2")));
});

it("enforces per-account quotas over HTTP without removing anonymous limits",async()=>{
 const {default:express}=await import("express");const {rateLimit}=await import("express-rate-limit");const {createServer}=await import("node:http");const app=express();app.use(rateLimit({windowMs:60000,limit:2,keyGenerator:globalRateLimitKey}));app.get("/",(_req,res)=>res.json({ok:true}));const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));try{const address=server.address() as import("node:net").AddressInfo;const url=`http://127.0.0.1:${address.port}/`;const get=(t?:string)=>fetch(url,{headers:t?{authorization:`Bearer ${t}`}:{}});const a=token(first),b=token(second);expect((await get(a)).status).toBe(200);expect((await get(a)).status).toBe(200);expect((await get(a)).status).toBe(429);expect((await get(b)).status).toBe(200);expect((await get()).status).toBe(200);expect((await get("forged")).status).toBe(200);expect((await get()).status).toBe(429);}finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
