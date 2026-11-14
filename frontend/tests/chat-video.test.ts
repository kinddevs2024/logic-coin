import { expect,it } from "vitest";
import { isChatVideo } from "../src/lib/chat-video";
it("renders old generic MP4 attachments as videos without changing their records",()=>{
  expect(isChatVideo({kind:"file",mime:"application/octet-stream",name:"20261105-1759-41.0523051.mp4"})).toBe(true);
  expect(isChatVideo({kind:"file",mime:"video/webm",name:"clip"})).toBe(true);
  expect(isChatVideo({kind:"voice",mime:"audio/mp4",name:"voice.m4a"})).toBe(false);
  expect(isChatVideo({kind:"file",mime:"application/pdf",name:"file.pdf"})).toBe(false);
});
