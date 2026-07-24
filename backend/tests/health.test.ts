import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("health API", () => {
  it("responds without requiring a database connection", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.body.data).toMatchObject({
      service: "logic-coin-api",
      status: "ok"
    });
    expect(response.body.data.database).toBeTypeOf("string");
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
  });

  it("returns a structured error for unknown routes", async () => {
    const response = await request(app).get("/not-a-route").expect(404);

    expect(response.body.error.code).toBe("route_not_found");
    expect(response.body.error.requestId).toBeTypeOf("string");
  });
});
