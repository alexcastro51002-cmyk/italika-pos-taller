import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import {
  type AuthenticatedRequest,
  requireAnyPermission,
  requireAuth,
  requirePermission,
} from "../../shared/http.js";
import { CommissionsRepository } from "./repo.js";
import {
  createCommissionRuleSchema,
  listCommissionsQuerySchema,
  updateCommissionConfigSchema,
} from "./schema.js";
import { CommissionsService } from "./service.js";

export function createCommissionsRouter(db: DatabaseSync): Router {
  const router = Router();
  const service = new CommissionsService(new CommissionsRepository(db));

  router.get(
    "/commissions/config",
    requireAuth(db),
    requirePermission("commissions:config"),
    (_req, res) => {
      res.json({
        config: service.getConfig(),
        rules: service.listRules(),
      });
    },
  );

  router.put(
    "/commissions/config",
    requireAuth(db),
    requirePermission("commissions:config"),
    (req, res, next) => {
      try {
        const input = updateCommissionConfigSchema.parse(req.body);
        const config = service.updateConfig(input);
        res.json({ config });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/commissions/rules",
    requireAuth(db),
    requirePermission("commissions:config"),
    (req, res, next) => {
      try {
        const input = createCommissionRuleSchema.parse(req.body);
        const rule = service.createRule(input);
        res.status(201).json({ rule });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    "/commissions/rules/:id",
    requireAuth(db),
    requirePermission("commissions:config"),
    (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        service.deleteRule(id);
        res.json({ deleted: true });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/commissions",
    requireAuth(db),
    requireAnyPermission("commissions:read_all", "commissions:read_own"),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const query = listCommissionsQuerySchema.parse(req.query);
        if (!req.user) {
          res
            .status(401)
            .json({ error: "UNAUTHORIZED", message: "No autenticado." });
          return;
        }
        res.json(service.listCommissions(req.user, query));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
