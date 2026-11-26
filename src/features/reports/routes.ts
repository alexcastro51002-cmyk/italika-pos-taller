import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../shared/http.js";
import { ReportsRepository } from "./repo.js";
import { reportQuerySchema, reportTypeSchema } from "./schema.js";
import { ReportsService } from "./service.js";

export function createReportsRouter(db: DatabaseSync): Router {
  const router = Router();
  const service = new ReportsService(new ReportsRepository(db));

  router.get(
    "/reports/sales",
    requireAuth(db),
    requirePermission("reports:read"),
    (req, res, next) => {
      try {
        const query = reportQuerySchema.parse(req.query);
        res.json({ report: service.getSalesReport(query) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/reports/services",
    requireAuth(db),
    requirePermission("reports:read"),
    (req, res, next) => {
      try {
        const query = reportQuerySchema.parse(req.query);
        res.json({ report: service.getServicesReport(query) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/reports/income",
    requireAuth(db),
    requirePermission("reports:read"),
    (req, res, next) => {
      try {
        const query = reportQuerySchema.parse(req.query);
        res.json({ report: service.getIncomeReport(query) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/reports/commissions",
    requireAuth(db),
    requirePermission("reports:read"),
    (req, res, next) => {
      try {
        const query = reportQuerySchema.parse(req.query);
        res.json({ report: service.getCommissionsReport(query) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/reports/:type/export",
    requireAuth(db),
    requirePermission("reports:export"),
    (req, res, next) => {
      try {
        const type = reportTypeSchema.parse(req.params.type);
        const query = reportQuerySchema.parse(req.query);
        const { filename, content } = service.exportCsv(type, query);
        res.setHeader("content-type", "text/csv; charset=utf-8");
        res.setHeader(
          "content-disposition",
          `attachment; filename="${filename}"`,
        );
        res.send(content);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
