import { z } from "zod";

export const createClientSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre del cliente debe tener al menos 2 caracteres."),
  telefono: z.string().trim().max(30).optional().default(""),
  correo: z
    .string()
    .trim()
    .email("Correo electrónico inválido.")
    .or(z.literal(""))
    .optional()
    .default(""),
});

export const saleItemInputSchema = z.object({
  servicioId: z.coerce.number().int().positive("Servicio inválido."),
  trabajadorId: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .default(null),
  fechaProgramada: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha programada inválida (YYYY-MM-DD).")
    .nullable()
    .optional()
    .default(null),
});

export const createSaleSchema = z.object({
  clienteId: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .default(null),
  clienteNombre: z.string().trim().max(120).optional().default(""),
  clienteTelefono: z.string().trim().max(30).optional().default(""),
  fechaVenta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de venta inválida (YYYY-MM-DD).")
    .optional(),
  descuentoAutorizado: z.coerce
    .number()
    .finite()
    .min(0, "El descuento no puede ser negativo.")
    .optional()
    .default(0),
  items: z
    .array(saleItemInputSchema)
    .min(1, "La venta debe incluir al menos un servicio del catálogo."),
});

export const listSalesQuerySchema = z.object({
  q: z.string().trim().optional().default(""),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
  serviceId: z.coerce.number().int().positive().optional(),
  workerId: z.coerce.number().int().positive().optional(),
  status: z.enum(["all", "VIGENTE", "CANCELADA"]).optional().default("all"),
});

export const cancelSaleSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, "El motivo de cancelación debe tener al menos 3 caracteres.")
    .max(300),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
