import { z } from "zod";

export const reportQuerySchema = z.object({
  groupBy: z.enum(["day", "week", "month"]).optional().default("day"),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
  serviceId: z.coerce.number().int().positive().optional(),
  workerId: z.coerce.number().int().positive().optional(),
  responsibleId: z.coerce.number().int().positive().optional(),
});

export const reportTypeSchema = z.enum([
  "sales",
  "services",
  "income",
  "commissions",
]);

export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ReportType = z.infer<typeof reportTypeSchema>;
