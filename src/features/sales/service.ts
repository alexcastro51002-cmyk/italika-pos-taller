import type { DomainEventBus } from "../../shared/events.js";
import { AppError } from "../../shared/http.js";
import type { ClientDTO, SaleDTO, WorkerDTO } from "../../shared/types.js";
import type { SalesRepository } from "./repo.js";
import type {
  CancelSaleInput,
  CreateClientInput,
  CreateSaleInput,
  ListSalesQuery,
} from "./schema.js";

export class SalesService {
  constructor(
    private readonly repo: SalesRepository,
    private readonly eventBus: DomainEventBus,
  ) {}

  listWorkers(includeInactive = false): WorkerDTO[] {
    return this.repo.listWorkers(includeInactive);
  }

  listClients(): ClientDTO[] {
    return this.repo.listClients();
  }

  createClient(input: CreateClientInput): ClientDTO {
    return this.repo.createClient(input);
  }

  listSales(query: ListSalesQuery): SaleDTO[] {
    return this.repo.listSales(query);
  }

  createSale(actorId: number, input: CreateSaleInput): SaleDTO {
    if (input.clienteId !== null) {
      const client = this.repo.findClientById(input.clienteId);
      if (!client) {
        throw new AppError(404, "CLIENT_NOT_FOUND", "Cliente no encontrado.");
      }
    }

    const resolvedItems: Array<{
      servicioId: number;
      servicioNombre: string;
      precioAplicado: number;
      trabajadorId: number | null;
      fechaProgramada: string | null;
    }> = [];

    let subtotal = 0;
    for (const item of input.items) {
      const svc = this.repo.findActiveService(item.servicioId);
      if (!svc) {
        throw new AppError(
          400,
          "SERVICE_UNAVAILABLE",
          `El servicio #${item.servicioId} no existe o se encuentra inactivo.`,
        );
      }
      if (item.trabajadorId !== null) {
        const worker = this.repo.findActiveWorker(item.trabajadorId);
        if (!worker) {
          throw new AppError(
            400,
            "WORKER_UNAVAILABLE",
            `El trabajador #${item.trabajadorId} no existe o está inactivo.`,
          );
        }
      }
      subtotal = Number((subtotal + svc.precioBase).toFixed(2));
      resolvedItems.push({
        servicioId: svc.id,
        servicioNombre: svc.nombre,
        precioAplicado: svc.precioBase,
        trabajadorId: item.trabajadorId,
        fechaProgramada: item.fechaProgramada,
      });
    }

    if (input.descuentoAutorizado > subtotal + 0.001) {
      throw new AppError(
        400,
        "INVALID_DISCOUNT",
        "El descuento autorizado no puede superar el subtotal de la venta.",
      );
    }

    const total = Math.max(
      0,
      Number((subtotal - input.descuentoAutorizado).toFixed(2)),
    );
    const fechaVenta =
      input.fechaVenta ?? new Date().toISOString().slice(0, 10);

    const created = this.repo.createSale({
      clienteId: input.clienteId,
      newClientName: input.clienteNombre,
      newClientPhone: input.clienteTelefono,
      registradoPor: actorId,
      fechaVenta,
      subtotal,
      descuentoAutorizado: input.descuentoAutorizado,
      total,
      items: resolvedItems,
    });

    this.eventBus.emit({
      type: "VentaRegistrada",
      ventaId: created.id,
      total: created.total,
      registradoPor: actorId,
    });

    return created;
  }

  cancelSale(actorId: number, saleId: number, input: CancelSaleInput): SaleDTO {
    const existing = this.repo.findSaleById(saleId);
    if (!existing) {
      throw new AppError(404, "SALE_NOT_FOUND", "Venta no encontrada.");
    }
    if (existing.estadoVenta === "CANCELADA") {
      throw new AppError(
        409,
        "SALE_ALREADY_CANCELLED",
        "La venta ya se encuentra cancelada.",
      );
    }

    const cancelled = this.repo.cancelSale(saleId, actorId, input.motivo);
    this.eventBus.emit({
      type: "VentaCancelada",
      ventaId: cancelled.id,
      canceladoPor: actorId,
      motivo: input.motivo,
    });
    return cancelled;
  }
}
