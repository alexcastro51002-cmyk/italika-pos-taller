import type { DomainEventBus } from "../../shared/events.js";
import { AppError } from "../../shared/http.js";
import type {
  AuthUser,
  WorkOrderDTO,
  WorkOrderSummaryDTO,
} from "../../shared/types.js";
import type { WorkOrdersRepository } from "./repo.js";
import type {
  ListWorkOrdersQuery,
  UpdateWorkOrderStatusInput,
} from "./schema.js";

export class WorkOrdersService {
  constructor(
    private readonly repo: WorkOrdersRepository,
    private readonly eventBus: DomainEventBus,
  ) {}

  list(
    actor: AuthUser,
    query: ListWorkOrdersQuery,
  ): { orders: WorkOrderDTO[]; summary: WorkOrderSummaryDTO } {
    const canReadAll = actor.permisos.includes("work:read_all");
    return this.repo.list(query, canReadAll ? undefined : actor.trabajadorId);
  }

  updateStatus(
    actor: AuthUser,
    detailId: number,
    input: UpdateWorkOrderStatusInput,
  ): WorkOrderDTO {
    const order = this.repo.findById(detailId);
    if (!order) {
      throw new AppError(
        404,
        "WORK_ORDER_NOT_FOUND",
        "Orden de servicio no encontrada.",
      );
    }
    if (order.estadoVenta === "CANCELADA") {
      throw new AppError(
        409,
        "SALE_CANCELLED",
        "No es posible actualizar un servicio ligado a una venta cancelada.",
      );
    }

    const canUpdateAll = actor.permisos.includes("work:update");
    if (!canUpdateAll) {
      if (order.trabajadorId !== actor.trabajadorId) {
        throw new AppError(
          403,
          "FORBIDDEN_WORK_ORDER",
          "Solo puedes confirmar servicios asignados a ti.",
        );
      }
      if (input.estado !== "REALIZADO") {
        throw new AppError(
          403,
          "FORBIDDEN_STATUS_TRANSITION",
          "El trabajador únicamente puede confirmar servicios como Realizado.",
        );
      }
    }

    const updated = this.repo.updateStatus(detailId, input.estado, actor.id);
    if (!updated) {
      throw new AppError(
        404,
        "WORK_ORDER_NOT_FOUND",
        "Orden de servicio no encontrada.",
      );
    }

    if (input.estado === "REALIZADO") {
      this.eventBus.emit({
        type: "ServicioRealizado",
        ventaId: updated.ventaId,
        ventaDetalleId: updated.id,
        trabajadorId: updated.trabajadorId,
      });
    }

    return updated;
  }
}
