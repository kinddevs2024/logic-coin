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
