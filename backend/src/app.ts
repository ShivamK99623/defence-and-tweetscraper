import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import apiRoutes from "./routes/api.routes";
import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import newsRoutes from "./routes/news.routes";
import constituencyRoutes from "./routes/constituency.routes";
import { requireAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ success: true, status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api", requireAuth);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/news", newsRoutes);
  app.use("/api/constituency", constituencyRoutes);
  app.use("/api", apiRoutes);

  app.use(errorHandler);

  return app;
}
