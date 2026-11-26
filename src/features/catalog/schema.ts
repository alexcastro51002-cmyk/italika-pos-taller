import { z } from "zod";

export const createServiceSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres."),
  descripcion: z.string().trim().max(500).optional().default(""),
  precioBase: z.coerce
    .number()
    .finite("El precio debe ser numérico.")
    .min(0, "El precio no puede ser negativo."),
  duracionMin: z.coerce
    .number()
    .int("La duración debe ser un número entero de minutos.")
    .min(1, "La duración debe ser mayor a 0 minutos."),
  activo: z.boolean().optional().default(true),
});

export const updateServiceSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres."),
  descripcion: z.string().trim().max(500).optional().default(""),
  precioBase: z.coerce
    .number()
    .finite("El precio debe ser numérico.")
    .min(0, "El precio no puede ser negativo."),
  duracionMin: z.coerce
    .number()
    .int("La duración debe ser un número entero de minutos.")
    .min(1, "La duración debe ser mayor a 0 minutos."),
});

export const updateServiceStatusSchema = z.object({
  activo: z.boolean(),
});

export const listServicesQuerySchema = z.object({
  q: z.string().trim().optional().default(""),
  active: z.enum(["true", "false", "all"]).optional().default("all"),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type UpdateServiceStatusInput = z.infer<
  typeof updateServiceStatusSchema
>;
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
