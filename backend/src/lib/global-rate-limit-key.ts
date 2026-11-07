import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { verifyAccessToken } from "../services/token.service.js";
// A carrier/Wi-Fi IP may be shared. Only a cryptographically verified account
// gets its own quota; arbitrary headers and invalid tokens never choose a key.
export function globalRateLimitKey(request:Request):string {
  const token=request.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if(token){try{const payload=verifyAccessToken(token);if(/^[a-f\d]{24}$/i.test(payload.sub)&&/^[a-f\d]{24}$/i.test(payload.sid))return `account:${payload.sub}`;}catch{/* Unauthenticated traffic retains the IP quota. */}}
  return `ip:${ipKeyGenerator(request.ip??request.socket.remoteAddress??"unknown")}`;
}
