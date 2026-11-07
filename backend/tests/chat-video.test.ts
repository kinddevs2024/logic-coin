import { expect,it } from "vitest";
import { chatVideoMime } from "../src/lib/chat-video.js";
it("recognizes a stored MP4 from its header even when originally uploaded as a file",()=>{
  expect(chatVideoMime("20261105-1759-41.0523051.mp4",Buffer.from([0,0,0,24,102,116,121,112]))).toBe("video/mp4");
  expect(chatVideoMime("clip.WEBM",Buffer.from([0x1a,0x45,0xdf,0xa3]))).toBe("video/webm");
});
it("keeps non-video files and spoofed extensions as downloads",()=>{
  expect(chatVideoMime("clip.mp4",Buffer.from("<script>"))).toBeNull();
  expect(chatVideoMime("archive.zip",Buffer.from([0,0,0,24,102,116,121,112]))).toBeNull();
});
