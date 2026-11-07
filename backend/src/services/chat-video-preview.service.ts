import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, rename, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import { ApiError } from "../lib/api-error.js";
const run = promisify(execFile);
const pending = new Map<string, Promise<string>>();
let active = 0;
const waiting: (() => void)[] = [];
export async function chatVideoPoster(file: string): Promise<string> {
  const poster = file + ".poster.jpg";
  try { await access(poster); return poster; } catch { /* Generate once, after media authorization. */ }
  const existing = pending.get(file);
  if (existing) return existing;
  if (pending.size >= 32) throw new ApiError(429,"preview_busy","Preview is loading");
  const task = (async () => {
    if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve));
    active++;
    const temp = poster + "." + randomBytes(8).toString("hex") + ".jpg";
    try {
      await run("ffmpeg",["-nostdin","-loglevel","error","-protocol_whitelist","file,pipe","-threads","1","-max_pixels","25000000","-i",file,"-frames:v","1","-vf","scale=640:360:force_original_aspect_ratio=decrease","-threads","1","-y",temp],{timeout:15000,maxBuffer:65536});
      await rename(temp,poster);
      return poster;
    } catch {
      throw new ApiError(415,"video_preview_unavailable","Video preview unavailable");
    } finally { await unlink(temp).catch(()=>{}); active--; waiting.shift()?.(); }
  })();
  pending.set(file,task);
  try { return await task; } finally { pending.delete(file); }
}
