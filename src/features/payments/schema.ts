import { z } from "zod";

export const paymentMethodSchema = z.enum([
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "OTRO",
]);

export const registerPaymentSchema = z.object({
  monto: z.coerce
    .number()
    .finite("El importe debe ser numérico.")
    .positive("El importe recibido debe ser mayor a cero."),
  metodoPago: paymentMethodSchema,
  fechaPago: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de pago inválida (YYYY-MM-DD).")
    .optional(),
});

export const registerRefundSchema = z.object({
  monto: z.coerce
    .number()
    .finite("El importe debe ser numérico.")
    .positive("El importe del reembolso debe ser mayor a cero."),
  metodoPago: paymentMethodSchema,
  fechaPago: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD).")
    .optional(),
});

export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;
export type RegisterRefundInput = z.infer<typeof registerRefundSchema>;
