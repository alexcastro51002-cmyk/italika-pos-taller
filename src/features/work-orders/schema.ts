import { z } from "zod";

export const executionStatusSchema = z.enum([
  "PENDIENTE",
  "PROGRAMADO",
  "EN_PROCESO",
  "REALIZADO",
  "CANCELADO",
]);

export const listWorkOrdersQuerySchema = z.object({
  workerId: z.coerce.number().int().positive().optional(),
  status: z
    .enum([
      "all",
      "PENDIENTE",
      "PROGRAMADO",
      "EN_PROCESO",
      "REALIZADO",
      "CANCELADO",
    ])
    .optional()
    .default("all"),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
});

export const updateWorkOrderStatusSchema = z.object({
  estado: executionStatusSchema,
});

export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuerySchema>;
export type UpdateWorkOrderStatusInput = z.infer<
  typeof updateWorkOrderStatusSchema
>;
