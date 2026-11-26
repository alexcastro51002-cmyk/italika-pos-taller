import { z } from "zod";

export const commissionTriggerSchema = z.enum([
  "AL_VENDER",
  "AL_REALIZAR",
  "AL_LIQUIDAR",
]);

export const commissionBaseSchema = z.enum([
  "BRUTO",
  "NETO_POST_DESCUENTO",
  "COBRADO_REAL",
]);

export const updateCommissionConfigSchema = z.object({
  disparadorTrabajador: commissionTriggerSchema,
  disparadorSecretaria: commissionTriggerSchema,
  baseElegible: commissionBaseSchema,
  secSoloVentasPropias: z.boolean(),
  tasaTrabajadorGlobal: z.coerce
    .number()
    .finite()
    .min(0, "La tasa no puede ser menor a 0%.")
    .max(100, "La tasa no puede superar 100%."),
  tasaSecretariaGlobal: z.coerce
    .number()
    .finite()
    .min(0, "La tasa no puede ser menor a 0%.")
    .max(100, "La tasa no puede superar 100%."),
});

export const createCommissionRuleSchema = z
  .object({
    trabajadorId: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .default(null),
    servicioId: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .default(null),
    porcentaje: z.coerce
      .number()
      .finite()
      .min(0, "El porcentaje debe estar entre 0 y 100.")
      .max(100, "El porcentaje debe estar entre 0 y 100."),
  })
  .refine(
    (data) => data.trabajadorId !== null || data.servicioId !== null,
    "Debes indicar al menos un trabajador o un servicio para la regla específica.",
  );

export const listCommissionsQuerySchema = z.object({
  beneficiaryType: z
    .enum(["all", "TRABAJADOR", "SECRETARIA"])
    .optional()
    .default("all"),
  workerId: z.coerce.number().int().positive().optional(),
  serviceId: z.coerce.number().int().positive().optional(),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
});

export type UpdateCommissionConfigInput = z.infer<
  typeof updateCommissionConfigSchema
>;
export type CreateCommissionRuleInput = z.infer<
  typeof createCommissionRuleSchema
>;
export type ListCommissionsQuery = z.infer<typeof listCommissionsQuerySchema>;
