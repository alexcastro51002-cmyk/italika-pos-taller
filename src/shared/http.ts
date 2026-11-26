import type { DatabaseSync } from "node:sqlite";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { verifyToken } from "./security.js";
import {
  type AuthUser,
  type Permission,
  type Role,
  resolveEffectivePermissions,
} from "./types.js";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface UserLookupRow {
  id: number;
  nombre: string;
  email: string;
  rol: Role;
  permisos_extra: string;
  activo: number;
  trabajador_id: number | null;
}

export function requireAuth(db: DatabaseSync) {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      next(new AppError(401, "UNAUTHORIZED", "Autenticación requerida."));
      return;
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const payload = verifyToken(token);
    if (!payload) {
      next(new AppError(401, "INVALID_TOKEN", "Sesión inválida o expirada."));
      return;
    }

    const row = db
      .prepare(
        `SELECT u.id, u.nombre, u.email, u.rol, u.permisos_extra, u.activo,
                t.id AS trabajador_id
         FROM usuarios u
         LEFT JOIN trabajadores t ON t.usuario_id = u.id
         WHERE u.id = ?`,
      )
      .get(payload.sub) as UserLookupRow | undefined;

    if (!row || row.activo !== 1) {
      next(
        new AppError(403, "USER_INACTIVE", "Usuario inactivo o no autorizado."),
      );
      return;
    }

    const extra = JSON.parse(row.permisos_extra) as Permission[];
    req.user = {
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      rol: row.rol,
      permisos: resolveEffectivePermissions(row.rol, extra),
      trabajadorId: row.trabajador_id ?? null,
    };
    next();
  };
}

export function requirePermission(...required: Permission[]) {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Autenticación requerida."));
      return;
    }
    const hasAll = required.every((perm) => req.user?.permisos.includes(perm));
    if (!hasAll) {
      next(
        new AppError(
          403,
          "FORBIDDEN",
          "No cuentas con permisos suficientes para esta operación.",
        ),
      );
      return;
    }
    next();
  };
}

export function requireAnyPermission(...accepted: Permission[]) {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Autenticación requerida."));
      return;
    }
    const hasAny = accepted.some((perm) => req.user?.permisos.includes(perm));
    if (!hasAny) {
      next(
        new AppError(
          403,
          "FORBIDDEN",
          "No cuentas con permisos suficientes para esta operación.",
        ),
      );
      return;
    }
    next();
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Datos de entrada inválidos.",
      details: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  const message =
    err instanceof Error ? err.message : "Error interno del servidor.";
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message,
  });
}
