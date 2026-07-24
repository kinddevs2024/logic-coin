import { Router } from "express";
import { databaseState } from "../config/database.js";

const router = Router();

router.get("/", (_request, response) => {
  response.json({
    data: {
      service: "logic-coin-api",
      status: "ok",
      database: databaseState(),
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
