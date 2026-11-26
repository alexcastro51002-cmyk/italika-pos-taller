import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import type { DomainEventBus } from "../../shared/events.js";
import {
  type AuthenticatedRequest,
  requireAnyPermission,
  requireAuth,
} from "../../shared/http.js";
import { WorkOrdersRepository } from "./repo.js";
import {
  listWorkOrdersQuerySchema,
  updateWorkOrderStatusSchema,
} from "./schema.js";
import { WorkOrdersService } from "./service.js";

export function createWorkOrdersRouter(
  db: DatabaseSync,
  eventBus: DomainEventBus,
): Router {
  const router = Router();
  const service = new WorkOrdersService(new WorkOrdersRepository(db), eventBus);

  router.get(
    "/work-orders",
    requireAuth(db),
    requireAnyPermission("work:read_all", "work:read_own"),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const query = listWorkOrdersQuerySchema.parse(req.query);
        if (!req.user) {
          res
            .status(401)
            .json({ error: "UNAUTHORIZED", message: "No autenticado." });
          return;
        }
        res.json(service.list(req.user, query));
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    "/work-orders/:id/status",
    requireAuth(db),
    requireAnyPermission("work:update", "work:confirm"),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        if (!req.user) {
          res
            .status(401)
            .json({ error: "UNAUTHORIZED", message: "No autenticado." });
          return;
        }
        const input = updateWorkOrderStatusSchema.parse(req.body);
        const order = service.updateStatus(req.user, id, input);
        res.json({ order });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
