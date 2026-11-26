import { z } from "zod";
import type { Permission, Role } from "../../shared/types.js";

export const roleSchema = z.enum(["ADMIN", "SECRETARIA", "TRABAJADOR"]);

export const permissionSchema = z.enum([
  "catalog:read",
  "catalog:write",
  "catalog:price",
  "sales:read",
  "sales:create",
  "sales:cancel",
  "payments:read",
  "payments:create",
  "payments:history",
  "work:read_all",
  "work:read_own",
  "work:update",
  "work:confirm",
  "commissions:config",
  "commissions:read_all",
  "commissions:read_own",
  "reports:read",
  "reports:export",
  "users:manage",
]) satisfies z.ZodType<Permission>;

export const loginSchema = z.object({
  email: z.string().trim().email("Correo electrónico inválido."),
  password: z.string().min(1, "La contraseña es requerida."),
});

export const createUserSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres."),
  email: z.string().trim().email("Correo electrónico inválido.").toLowerCase(),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
  rol: roleSchema,
  telefono: z.string().trim().max(30).optional().default(""),
  permisosExtra: z.array(permissionSchema).optional().default([]),
});

export const updatePermissionsSchema = z.object({
  rol: roleSchema.optional(),
  permisosExtra: z.array(permissionSchema).optional(),
  activo: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;
export type RoleValue = Role;
