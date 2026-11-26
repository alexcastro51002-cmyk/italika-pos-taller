import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import type { DomainEventBus } from "../../shared/events.js";
import {
  type AuthenticatedRequest,
  requireAnyPermission,
  requireAuth,
  requirePermission,
} from "../../shared/http.js";
import { SalesRepository } from "./repo.js";
import {
  cancelSaleSchema,
  createClientSchema,
  createSaleSchema,
  listSalesQuerySchema,
} from "./schema.js";
import { SalesService } from "./service.js";

export function createSalesRouter(
  db: DatabaseSync,
  eventBus: DomainEventBus,
): Router {
  const router = Router();
  const service = new SalesService(new SalesRepository(db), eventBus);

  router.get(
    "/workers",
    requireAuth(db),
    requireAnyPermission(
      "sales:read",
      "work:read_all",
      "commissions:read_all",
      "reports:read",
    ),
    (req, res) => {
      const includeInactive = req.query.includeInactive === "true";
      res.json({ workers: service.listWorkers(includeInactive) });
    },
  );

  router.get(
    "/clients",
    requireAuth(db),
    requirePermission("sales:read"),
    (_req, res) => {
      res.json({ clients: service.listClients() });
    },
  );

  router.post(
    "/clients",
    requireAuth(db),
    requirePermission("sales:create"),
    (req, res, next) => {
      try {
        const input = createClientSchema.parse(req.body);
        const client = service.createClient(input);
        res.status(201).json({ client });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/sales",
    requireAuth(db),
    requirePermission("sales:read"),
    (req, res, next) => {
      try {
        const query = listSalesQuerySchema.parse(req.query);
        res.json({ sales: service.listSales(query) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/sales",
    requireAuth(db),
    requirePermission("sales:create"),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const input = createSaleSchema.parse(req.body);
        const actorId = req.user?.id ?? 0;
        const sale = service.createSale(actorId, input);
        res.status(201).json({ sale });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/sales/:id/cancel",
    requireAuth(db),
    requirePermission("sales:cancel"),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const saleId = Number(req.params.id);
        if (!Number.isInteger(saleId) || saleId <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        const input = cancelSaleSchema.parse(req.body);
        const actorId = req.user?.id ?? 0;
        const sale = service.cancelSale(actorId, saleId, input);
        res.json({ sale });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
