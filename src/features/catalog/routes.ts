import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { requireAuth, requirePermission } from "../../shared/http.js";
import { CatalogRepository } from "./repo.js";
import {
  createServiceSchema,
  listServicesQuerySchema,
  updateServiceSchema,
  updateServiceStatusSchema,
} from "./schema.js";
import { CatalogService } from "./service.js";

export function createCatalogRouter(db: DatabaseSync): Router {
  const router = Router();
  const service = new CatalogService(new CatalogRepository(db));

  router.get(
    "/services",
    requireAuth(db),
    requirePermission("catalog:read"),
    (req, res, next) => {
      try {
        const query = listServicesQuerySchema.parse(req.query);
        res.json({ services: service.list(query) });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/services",
    requireAuth(db),
    requirePermission("catalog:write", "catalog:price"),
    (req, res, next) => {
      try {
        const input = createServiceSchema.parse(req.body);
        const created = service.create(input);
        res.status(201).json({ service: created });
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    "/services/:id",
    requireAuth(db),
    requirePermission("catalog:write", "catalog:price"),
    (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        const input = updateServiceSchema.parse(req.body);
        const updated = service.update(id, input);
        res.json({ service: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    "/services/:id/status",
    requireAuth(db),
    requirePermission("catalog:write"),
    (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        const input = updateServiceStatusSchema.parse(req.body);
        const updated = service.setStatus(id, input.activo);
        res.json({ service: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
