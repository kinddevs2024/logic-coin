import express from "express";
import cors from "cors";
import helmet from "helmet";
import { API_PREFIX } from "./config/constants.js";
import { env } from "./config/env.js";
import { ApiError } from "./lib/api-error.js";
import { requireAuth } from "./middleware/auth.js";
import { requireDatabase } from "./middleware/database.js";
import { attachRequestId, errorHandler, notFoundHandler } from "./middleware/errors.js";
import { globalLimiter } from "./middleware/rate-limits.js";
import activityRoutes from "./routes/activity.routes.js";
import authRoutes from "./routes/auth.routes.js";
import bonusesRoutes from "./routes/bonuses.routes.js";
import bootstrapRoutes from "./routes/bootstrap.routes.js";
import devicesRoutes from "./routes/devices.routes.js";
import healthRoutes from "./routes/health.routes.js";
import meRoutes from "./routes/me.routes.js";
import referralsRoutes from "./routes/referrals.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import withdrawalsRoutes from "./routes/withdrawals.routes.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(attachRequestId);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    credentials: false,
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes("*") || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, "cors_origin_denied", "Origin is not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type", "idempotency-key", "x-request-id"],
    exposedHeaders: ["x-request-id", "ratelimit", "ratelimit-policy"]
  })
);
app.use(express.json({ limit: "32kb" }));
app.use(globalLimiter);

const api = express.Router();
api.use("/health", healthRoutes);
api.use(requireDatabase);
api.use("/auth", authRoutes);
api.use(requireAuth);
api.use("/bootstrap", bootstrapRoutes);
api.use("/me", meRoutes);
api.use("/tasks", tasksRoutes);
api.use("/wallet", walletRoutes);
api.use("/activity", activityRoutes);
api.use("/bonuses", bonusesRoutes);
api.use("/referrals", referralsRoutes);
api.use("/withdrawals", withdrawalsRoutes);
api.use("/devices", devicesRoutes);

app.get("/", (_request, response) => {
  response.json({
    data: {
      service: "Logic Coin API",
      version: "v1",
      health: `${API_PREFIX}/health`
    }
  });
});
app.use(API_PREFIX, api);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
