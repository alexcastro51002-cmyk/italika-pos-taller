import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import {
  type AuthenticatedRequest,
  requireAuth,
  requirePermission,
} from "../../shared/http.js";
import { AuthRepository } from "./repo.js";
import {
  createUserSchema,
  loginSchema,
  updatePermissionsSchema,
} from "./schema.js";
import { AuthService } from "./service.js";

export function createAuthRouter(db: DatabaseSync): Router {
  const router = Router();
  const service = new AuthService(new AuthRepository(db));

  router.post("/auth/login", (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      res.json(service.login(input));
    } catch (err) {
      next(err);
    }
  });

  router.get("/auth/me", requireAuth(db), (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  router.get(
    "/users",
    requireAuth(db),
    requirePermission("users:manage"),
    (_req, res) => {
      res.json({ users: service.listUsers() });
    },
  );

  router.post(
    "/users",
    requireAuth(db),
    requirePermission("users:manage"),
    (req, res, next) => {
      try {
        const input = createUserSchema.parse(req.body);
        const created = service.createUser(input);
        res.status(201).json({ user: created });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    "/users/:id/permissions",
    requireAuth(db),
    requirePermission("users:manage"),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const targetId = Number(req.params.id);
        if (!Number.isInteger(targetId) || targetId <= 0) {
          res
            .status(400)
            .json({ error: "INVALID_ID", message: "Identificador inválido." });
          return;
        }
        const input = updatePermissionsSchema.parse(req.body);
        const actorId = req.user?.id ?? 0;
        const updated = service.updatePermissions(actorId, targetId, input);
        res.json({ user: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
