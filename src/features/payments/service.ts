import type { DomainEventBus } from "../../shared/events.js";
import { AppError } from "../../shared/http.js";
import type {
  PaymentAccountSummaryDTO,
  PaymentDTO,
  ReceiptDTO,
} from "../../shared/types.js";
import type { PaymentsRepository } from "./repo.js";
import type { RegisterPaymentInput, RegisterRefundInput } from "./schema.js";

export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly eventBus: DomainEventBus,
  ) {}

  listSummaries(): PaymentAccountSummaryDTO[] {
    return this.repo.listAccountSummaries();
  }

  getHistory(ventaId: number): PaymentDTO[] {
    const account = this.repo.findSaleAccount(ventaId);
    if (!account) {
      throw new AppError(404, "SALE_NOT_FOUND", "Venta no encontrada.");
    }
    return this.repo.listPaymentsBySale(ventaId);
  }

  getReceipt(ventaId: number): ReceiptDTO {
    const receipt = this.repo.getReceipt(ventaId);
    if (!receipt) {
      throw new AppError(404, "SALE_NOT_FOUND", "Venta no encontrada.");
    }
    return receipt;
  }

  registerPayment(
    actorId: number,
    ventaId: number,
    input: RegisterPaymentInput,
  ): { payment: PaymentDTO; account: PaymentAccountSummaryDTO } {
    const account = this.repo.findSaleAccount(ventaId);
    if (!account) {
      throw new AppError(404, "SALE_NOT_FOUND", "Venta no encontrada.");
    }
    if (account.estado_venta === "CANCELADA") {
      throw new AppError(
        409,
        "SALE_CANCELLED",
        "No se pueden registrar pagos sobre una venta cancelada.",
      );
    }

    const saldoPendiente = Math.max(
      0,
      Number((account.total - account.pagado).toFixed(2)),
    );
    if (saldoPendiente <= 0.001) {
      throw new AppError(
        409,
        "SALE_ALREADY_PAID",
        "La venta ya se encuentra liquidada.",
      );
    }
    if (input.monto > saldoPendiente + 0.001) {
      throw new AppError(
        400,
        "AMOUNT_EXCEEDS_BALANCE",
        `El pago no puede superar el saldo pendiente ($${saldoPendiente.toFixed(2)}).`,
      );
    }

    const fechaPago = input.fechaPago ?? new Date().toISOString().slice(0, 10);
    const payment = this.repo.insertPayment({
      ventaId,
      monto: Number(input.monto.toFixed(2)),
      tipo: "PAGO",
      metodoPago: input.metodoPago,
      fechaPago,
      registradoPor: actorId,
    });

    const updatedAccount = this.repo
      .listAccountSummaries()
      .find((s) => s.ventaId === ventaId);
    if (!updatedAccount) {
      throw new Error("No se pudo obtener el resumen actualizado.");
    }

    this.eventBus.emit({
      type: "PagoRegistrado",
      ventaId,
      pagoId: payment.id,
      monto: payment.monto,
      liquidada: updatedAccount.saldoPendiente <= 0.001,
    });

    return { payment, account: updatedAccount };
  }

  registerRefund(
    actorId: number,
    ventaId: number,
    input: RegisterRefundInput,
  ): { refund: PaymentDTO; account: PaymentAccountSummaryDTO } {
    const account = this.repo.findSaleAccount(ventaId);
    if (!account) {
      throw new AppError(404, "SALE_NOT_FOUND", "Venta no encontrada.");
    }
    const netoPagado = Math.max(0, Number(account.pagado.toFixed(2)));
    if (input.monto > netoPagado + 0.001) {
      throw new AppError(
        400,
        "REFUND_EXCEEDS_PAID",
        `El reembolso no puede superar el importe cobrado ($${netoPagado.toFixed(2)}).`,
      );
    }

    const fechaPago = input.fechaPago ?? new Date().toISOString().slice(0, 10);
    const refund = this.repo.insertPayment({
      ventaId,
      monto: -Number(input.monto.toFixed(2)),
      tipo: "REEMBOLSO",
      metodoPago: input.metodoPago,
      fechaPago,
      registradoPor: actorId,
    });

    const updatedAccount = this.repo
      .listAccountSummaries()
      .find((s) => s.ventaId === ventaId);
    if (!updatedAccount) {
      throw new Error("No se pudo obtener el resumen actualizado.");
    }

    this.eventBus.emit({
      type: "PagoReembolsado",
      ventaId,
      pagoId: refund.id,
      monto: input.monto,
    });

    return { refund, account: updatedAccount };
  }
}
