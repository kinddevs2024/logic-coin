import {afterEach,expect,it,vi} from "vitest";
import sharp from "sharp";
import {isTelegramAvatar,isAvatarRedirect,renderTelegramAvatar} from "../src/lib/telegram-avatar.js";
import {listAvatarUrl,listAvatarRevision} from "../src/lib/list-avatar.js";
afterEach(()=>vi.unstubAllGlobals());
const url="https://t.me/i/userpic/320/Example.svg";
it("uses a local versioned thumbnail for Telegram and stored relative avatars",()=>{const output=listAvatarUrl("111111111111111111111111",url)!;expect(new URL(output).pathname).toBe(`/api/v1/avatars/111111111111111111111111/${listAvatarRevision(url)}.webp`);expect(listAvatarUrl("111111111111111111111111","/api/v1/avatars/111111111111111111111111/222222222222222222222222/original")).toContain("222222222222222222222222.webp");});
it("accepts only the exact HTTPS Telegram userpic endpoint",()=>{expect(isTelegramAvatar(url)).toBe(true);for(const value of ["http://t.me/i/userpic/320/a.svg","https://t.me.evil.test/i/userpic/a.svg","https://127.0.0.1/i/userpic/a.svg","https://t.me/else/a.svg","https://user@t.me/i/userpic/a.svg","https://t.me/i/userpic/a.svg?url=else"])expect(isTelegramAvatar(value)).toBe(false);});
it("converts SVG images to real WebP for Android",async()=>{const svg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="green"/></svg>';vi.stubGlobal("fetch",vi.fn(async()=>new Response(svg,{headers:{"content-type":"image/svg+xml"}})));const result=await renderTelegramAvatar(url);const meta=await sharp(result).metadata();expect(meta.format).toBe("webp");expect(meta.width).toBe(160);});
it("rejects non-images and oversized responses",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response("html",{headers:{"content-type":"text/html"}})));await expect(renderTelegramAvatar(url)).rejects.toThrow();vi.stubGlobal("fetch",vi.fn(async()=>new Response("",{headers:{"content-type":"image/jpeg","content-length":"6000000"}})));await expect(renderTelegramAvatar(url)).rejects.toThrow();});

it("allows only Telegram's image CDN redirects",async()=>{
 expect(isAvatarRedirect("https://cdn4.telesco.pe/file/example.jpg")).toBe(true);
 for(const value of ["http://cdn4.telesco.pe/file/a.jpg","https://cdn4.telesco.pe.evil.test/file/a.jpg","https://127.0.0.1/file/a.jpg","https://cdn4.telesco.pe/else/a.jpg"])expect(isAvatarRedirect(value)).toBe(false);
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:302,headers:{location:"https://127.0.0.1/avatar.png"}})));
 await expect(renderTelegramAvatar(url)).rejects.toThrow("Unsupported avatar redirect");
});
