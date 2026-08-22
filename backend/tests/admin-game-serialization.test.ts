import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { serializeGame } from "../src/services/serialization.service.js";

describe("admin game serialization", () => {
  it("round-trips enabled, sortOrder, and scoring fields needed by admin editing", () => {
    const game = serializeGame(
      {
        _id: new Types.ObjectId(),
        key: "tsvet",
        slug: "tsvet",
        title: { en: "Color", ru: "Цвет", uz: "Rang" },
        description: { en: "Pick a color", ru: "Выберите цвет", uz: "Rangni tanlang" },
        icon: "color-palette",
        color: "#EC4899",
        engine: "native",
        clientPath: "/play/tsvet",
        difficulty: "medium",
        enabled: false,
        challengeEnabled: true,
        practiceEnabled: false,
        sortOrder: 240,
        scoring: { higherIsBetter: false, maxCoins: 700 }
      },
      "ru"
    );

    expect(game).toMatchObject({
      key: "tsvet",
      enabled: false,
      sortOrder: 240,
      scoring: { higherIsBetter: false, maxCoins: 700 },
      challengeEnabled: true,
      practiceEnabled: false
    });
  });
});
