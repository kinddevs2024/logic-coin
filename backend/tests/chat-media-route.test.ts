import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("../src/services/chat.service.js", () => ({ readChatAttachment: read }));
import { chatMediaRoutes } from "../src/routes/chat.routes.js";
const app = express();
app.use("/api/v1/chat", chatMediaRoutes);
const url = "/api/v1/chat/media/aaaaaaaaaaaaaaaaaaaaaaaa?u=bbbbbbbbbbbbbbbbbbbbbbbb&s=cccccccccccccccccccccccc&e=123&t=signed";
beforeEach(() => { read.mockReset().mockResolvedValue({ bytes: Buffer.from("0123456789"), mime: "audio/mp4", name: "voice.m4a" }); });
it("allows audio in browser media documents without allowing scripts", async () => {
  const res = await request(app).get(url);
  expect(res.status).toBe(200);
  expect(res.headers["content-security-policy"]).toContain("media-src 'self'");
  expect(res.headers["content-security-policy"]).not.toContain("allow-scripts");
  expect(res.headers["accept-ranges"]).toBe("bytes");
  expect(res.headers["cache-control"]).toBe("private, no-store");
  expect(read).toHaveBeenCalledOnce();
});
it("serves authenticated audio byte ranges for mobile players", async () => {
  const res = await request(app).get(url).set("Range", "bytes=2-5");
  expect(res.status).toBe(206);
  expect(res.headers["content-range"]).toBe("bytes 2-5/10");
  expect(res.headers["content-length"]).toBe("4");
  expect(read).toHaveBeenCalledOnce();
});
it("rejects unsatisfiable audio ranges", async () => {
  const res = await request(app).get(url).set("Range", "bytes=20-");
  expect(res.status).toBe(416);
  expect(res.headers["content-range"]).toBe("bytes */10");
});
it("validates media access before serving any byte range", async () => {
  read.mockRejectedValueOnce(new Error("File access denied"));
  const res = await request(app).get(url).set("Range", "bytes=0-1");
  expect(res.status).toBe(500);
  expect(res.headers["content-range"]).toBeUndefined();
});
