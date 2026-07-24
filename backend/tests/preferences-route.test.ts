import express from "express";
import request from "supertest";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userModelMocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  findOneAndUpdate: vi.fn()
}));

vi.mock("../src/models/User.js", () => ({
  User: userModelMocks
}));

import meRoutes from "../src/routes/me.routes.js";

function selected(value: unknown) {
  return {
    select: vi.fn().mockResolvedValue(value)
  };
}

describe("preferences route", () => {
  const userId = new Types.ObjectId();
  const app = express();

  app.use(express.json());
  app.use((request, _response, next) => {
    request.auth = { userId, sessionId: new Types.ObjectId().toString() };
    next();
  });
  app.use("/", meRoutes);

  beforeEach(() => {
    userModelMocks.findById.mockReturnValue(
      selected({
        preferences: {
          language: "ru",
          theme: "light",
          notificationsEnabled: true,
          dailyReminderEnabled: true,
          timezone: "Asia/Tashkent"
        }
      })
    );
    userModelMocks.findByIdAndUpdate.mockReturnValue(
      selected({
        preferences: {
          language: "ru",
          theme: "dark",
          notificationsEnabled: true,
          dailyReminderEnabled: true,
          timezone: "Asia/Tashkent"
        }
      })
    );
  });

  it("updates other settings when the submitted timezone is unchanged", async () => {
    const response = await request(app)
      .patch("/preferences")
      .send({ theme: "dark", timezone: "Asia/Tashkent" })
      .expect(200);

    expect(userModelMocks.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      { $set: { "preferences.theme": "dark" } },
      { new: true, runValidators: true }
    );
    expect(response.body.data.preferences).toMatchObject({
      theme: "dark",
      timezone: "Asia/Tashkent"
    });
  });
});
