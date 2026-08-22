import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userMocks = vi.hoisted(() => ({ findByIdAndUpdate: vi.fn(), findById: vi.fn() }));
vi.mock("../src/models/User.js", () => ({ User: userMocks }));
vi.mock("../src/services/serialization.service.js", () => ({
  serializeUser: vi.fn(() => ({ id: "user-id" }))
}));

import meRoutes from "../src/routes/me.routes.js";

describe("profile avatar upload", () => {
  const userId = new Types.ObjectId();
  const app = express();
  app.use(express.json({ limit: "2200kb" }));
  app.use((req, _res, next) => {
    req.auth = { userId };
    next();
  });
  app.use("/", meRoutes);
  app.use((error: { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.statusCode ?? 500).json({ error: { code: error.code ?? "internal_error" } });
  });

  beforeEach(() => {
    userMocks.findByIdAndUpdate.mockReset();
    userMocks.findByIdAndUpdate.mockResolvedValue({ _id: userId });
  });

  it("accepts a file-derived PNG data URL on /profile", async () => {
    const avatarDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    await request(app).patch("/profile").send({ avatarDataUrl }).expect(200);
    expect(userMocks.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      { $set: { avatarUrl: avatarDataUrl } },
      { new: true, runValidators: true }
    );
  });

  it("rejects arbitrary URLs and non-image data URLs", async () => {
    await request(app).patch("/profile").send({ avatarUrl: "https://example.com/avatar.png" }).expect(400);
    await request(app)
      .patch("/profile")
      .send({ avatarDataUrl: "data:text/html;base64,PHNjcmlwdD4=" })
      .expect(400);
    expect(userMocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
