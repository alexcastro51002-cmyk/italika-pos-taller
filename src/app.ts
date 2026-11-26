import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import express, { type Express } from "express";
import { createAuthRouter } from "./features/auth/index.js";
import { createCatalogRouter } from "./features/catalog/index.js";
import {
  createCommissionsRouter,
  registerCommissionListeners,
} from "./features/commissions/index.js";
import { createPaymentsRouter } from "./features/payments/index.js";
import { createReportsRouter } from "./features/reports/index.js";
import { createSalesRouter } from "./features/sales/index.js";
import { createWorkOrdersRouter } from "./features/work-orders/index.js";
import { DomainEventBus } from "./shared/events.js";
import { errorHandler } from "./shared/http.js";

export function createApp(db: DatabaseSync): Express {
  const app = express();
  app.use(express.json());

  const eventBus = new DomainEventBus();
  registerCommissionListeners(db, eventBus);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "svas" });
  });

  app.use("/api", createAuthRouter(db));
  app.use("/api", createCatalogRouter(db));
  app.use("/api", createSalesRouter(db, eventBus));
  app.use("/api", createPaymentsRouter(db, eventBus));
  app.use("/api", createWorkOrdersRouter(db, eventBus));
  app.use("/api", createCommissionsRouter(db));
  app.use("/api", createReportsRouter(db));

  const distDir = resolve(process.cwd(), "dist");
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    const indexHtml = resolve(distDir, "index.html");
    if (existsSync(indexHtml)) {
      app.use((req, res, next) => {
        if (req.method === "GET" && !req.path.startsWith("/api")) {
          res.sendFile(indexHtml);
          return;
        }
        next();
      });
    }
  }

  app.use(errorHandler);
  return app;
}
