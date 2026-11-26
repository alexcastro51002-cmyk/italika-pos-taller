import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import type { DomainEventBus } from "../../shared/events.js";
import {
  type AuthenticatedRequest,
  requireAuth,
  requirePermission,
} from "../../shared/http.js";
import { PaymentsRepository } from "./repo.js";
import { registerPaymentSchema, registerRefundSchema } from "./schema.js";
import { PaymentsService } from "./service.js";

export function createPaymentsRouter(
  db: DatabaseSync,
  eventBus: DomainEventBus,
): Router {
  const router = Router();
  const service = new PaymentsService(new PaymentsRepository(db), eventBus);

  router.get(
    "/payments/summary",
    requireAuth(db),
    requirePermission("payments:read"),
    (_req, res) => {
      res.json({ summaries: service.listSummaries() });
    },
  );

  router.get(
    "/sales/:id/payments",
    requireAuth(db),
    requirePermission("payments:history"),
    (req, res, next) => {
      try {
        const ventaId = Number(req.params.id);
        if (!Number.isInteger(ventaId) || ventaId <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        res.json({ payments: service.getHistory(ventaId) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/sales/:id/payments",
    requireAuth(db),
    requirePermission("payments:create"),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const ventaId = Number(req.params.id);
        if (!Number.isInteger(ventaId) || ventaId <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        const input = registerPaymentSchema.parse(req.body);
        const actorId = req.user?.id ?? 0;
        const result = service.registerPayment(actorId, ventaId, input);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/sales/:id/refunds",
    requireAuth(db),
    requirePermission("sales:cancel"),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const ventaId = Number(req.params.id);
        if (!Number.isInteger(ventaId) || ventaId <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        const input = registerRefundSchema.parse(req.body);
        const actorId = req.user?.id ?? 0;
        const result = service.registerRefund(actorId, ventaId, input);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/sales/:id/receipt",
    requireAuth(db),
    requirePermission("payments:read"),
    (req, res, next) => {
      try {
        const ventaId = Number(req.params.id);
        if (!Number.isInteger(ventaId) || ventaId <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        res.json({ receipt: service.getReceipt(ventaId) });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
