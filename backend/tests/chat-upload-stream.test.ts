import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { Types } from "mongoose";
const model = vi.hoisted(() => ({ aggregate:vi.fn(),create:vi.fn() }));
vi.mock("../src/models/Chat.js", () => ({ ChatAttachment:model }));
vi.mock("../src/services/chat.service.js", () => ({ uploadChatAttachmentBuffer:vi.fn() }));
import { CHAT_FILE_LIMIT, uploadChatStream } from "../src/services/chat-upload.service.js";
let root: string;
beforeAll(async () => { root = await mkdtemp(path.join(tmpdir(), "logic-chat-upload-")); });
const previous = process.env.CHAT_MEDIA_DIR;
const user = new Types.ObjectId();
const metadata = {name:"archive.zip",mime:"application/zip",kind:"file" as const};
beforeEach(() => {process.env.CHAT_MEDIA_DIR=root;model.aggregate.mockResolvedValue([]);model.create.mockResolvedValue({_id:"aaaaaaaaaaaaaaaaaaaaaaaa"});});
afterAll(async () => {
  if(previous===undefined)delete process.env.CHAT_MEDIA_DIR;else process.env.CHAT_MEDIA_DIR=previous;
  if(!path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+"logic-chat-upload-"))throw new Error("Unexpected cleanup path");
  await rm(root,{recursive:true,force:true});
});
it("streams a complete 200 MiB file without a base64 payload",async()=>{
  const chunk=Buffer.alloc(1024*1024);
  const result=await uploadChatStream(user,metadata,Readable.from((function*(){for(let i=0;i<200;i++)yield chunk;})()),CHAT_FILE_LIMIT);
  expect(result.size).toBe(CHAT_FILE_LIMIT);
  const saved=model.create.mock.calls.at(-1)![0];
  expect((await stat(path.join(root,saved.storageKey))).size).toBe(CHAT_FILE_LIMIT);
  expect(saved.mime).toBe("application/octet-stream");
},30000);
it("rejects files above 200 MiB before consuming the stream",async()=>{
  const stream=Readable.from([Buffer.from("x")]);
  await expect(uploadChatStream(user,metadata,stream,CHAT_FILE_LIMIT+1)).rejects.toMatchObject({statusCode:413});
  expect(stream.readableDidRead).toBe(false);
});
it("removes an incomplete upload from disk",async()=>{
  const before=await readdir(root);
  await expect(uploadChatStream(user,metadata,Readable.from([Buffer.from("x")]),5)).rejects.toMatchObject({code:"invalid_attachment"});
  expect(await readdir(root)).toEqual(before);
});
it("rejects invalid content without leaving a file",async()=>{
  const before=await readdir(root);
  await expect(uploadChatStream(user,{...metadata,mime:"application/pdf"},Readable.from([Buffer.from("bad")]),3)).rejects.toMatchObject({code:"invalid_attachment"});
  expect(await readdir(root)).toEqual(before);
});
