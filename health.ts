import express, { Request, Response } from "express";
import { logger } from "./logger";

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  uptime: number;
  lastSuccessfulUpdate: number | null;
  consecutiveFailures: number;
  totalUpdates: number;
  dryRun: boolean;
}

let healthStatus: HealthStatus = {
  status: "ok",
  uptime: Date.now(),
  lastSuccessfulUpdate: null,
  consecutiveFailures: 0,
  totalUpdates: 0,
  dryRun: process.env.DRY_RUN === "true",
};

export function recordSuccess(ts: number): void {
  healthStatus.lastSuccessfulUpdate = ts;
  healthStatus.consecutiveFailures = 0;
  healthStatus.totalUpdates += 1;
  healthStatus.status = "ok";
}

export function recordFailure(): void {
  healthStatus.consecutiveFailures += 1;
  if (healthStatus.consecutiveFailures >= 3) {
    healthStatus.status = "degraded";
  }
  if (healthStatus.consecutiveFailures >= 10) {
    healthStatus.status = "error";
  }
}

export function startHealthServer(port: number): void {
  const app = express();

  app.get("/health", (_req: Request, res: Response) => {
    const payload = {
      ...healthStatus,
      uptimeSeconds: Math.floor((Date.now() - healthStatus.uptime) / 1000),
    };
    const httpCode = healthStatus.status === "ok" ? 200 : 503;
    res.status(httpCode).json(payload);
  });

  app.get("/ready", (_req: Request, res: Response) => {
    res.status(200).json({ ready: true });
  });

  app.listen(port, () => {
    logger.info(`Health server listening on port ${port}`);
  });
}
