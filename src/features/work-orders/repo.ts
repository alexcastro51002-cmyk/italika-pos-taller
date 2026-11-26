import type { DatabaseSync } from "node:sqlite";
import type {
  SaleStatus,
  ServiceExecutionStatus,
  WorkOrderDTO,
  WorkOrderSummaryDTO,
} from "../../shared/types.js";
import type { ListWorkOrdersQuery } from "./schema.js";

interface WorkOrderRow {
  id: number;
  venta_id: number;
  folio: string;
  fecha_venta: string;
  estado_venta: SaleStatus;
  cliente_nombre: string | null;
  servicio_id: number;
  servicio_nombre_snap: string;
  precio_aplicado: number;
  trabajador_id: number | null;
  trabajador_nombre: string | null;
  fecha_programada: string | null;
  estado_servicio: ServiceExecutionStatus;
  fecha_realizacion: string | null;
}

function mapRow(r: WorkOrderRow): WorkOrderDTO {
  return {
    id: r.id,
    ventaId: r.venta_id,
    folio: r.folio,
    fechaVenta: r.fecha_venta,
    estadoVenta: r.estado_venta,
    clienteNombre: r.cliente_nombre,
    servicioId: r.servicio_id,
    servicioNombre: r.servicio_nombre_snap,
    precioAplicado: r.precio_aplicado,
    trabajadorId: r.trabajador_id,
    trabajadorNombre: r.trabajador_nombre,
    fechaProgramada: r.fecha_programada,
    estadoServicio: r.estado_servicio,
    fechaRealizacion: r.fecha_realizacion,
  };
}

export class WorkOrdersRepository {
  constructor(private readonly db: DatabaseSync) {}

  list(
    query: ListWorkOrdersQuery,
    forcedWorkerId?: number | null,
  ): {
    orders: WorkOrderDTO[];
    summary: WorkOrderSummaryDTO;
  } {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (forcedWorkerId !== undefined) {
      if (forcedWorkerId === null) {
        clauses.push("1 = 0");
      } else {
        clauses.push("vd.trabajador_id = ?");
        params.push(forcedWorkerId);
      }
    } else if (query.workerId) {
      clauses.push("vd.trabajador_id = ?");
      params.push(query.workerId);
    }

    if (query.status !== "all") {
      clauses.push("vd.estado_servicio = ?");
      params.push(query.status);
    }
    if (query.from) {
      clauses.push(
        "COALESCE(SUBSTR(vd.fecha_realizacion, 1, 10), vd.fecha_programada, v.fecha_venta) >= ?",
      );
      params.push(query.from);
    }
    if (query.to) {
      clauses.push(
        "COALESCE(SUBSTR(vd.fecha_realizacion, 1, 10), vd.fecha_programada, v.fecha_venta) <= ?",
      );
      params.push(query.to);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT vd.id, vd.venta_id, v.folio, v.fecha_venta, v.estado_venta,
                c.nombre AS cliente_nombre, vd.servicio_id, vd.servicio_nombre_snap,
                vd.precio_aplicado, vd.trabajador_id, t.nombre AS trabajador_nombre,
                vd.fecha_programada, vd.estado_servicio, vd.fecha_realizacion
         FROM venta_detalles vd
         JOIN ventas v ON v.id = vd.venta_id
         LEFT JOIN clientes c ON c.id = v.cliente_id
         LEFT JOIN trabajadores t ON t.id = vd.trabajador_id
         ${where}
         ORDER BY v.fecha_venta DESC, vd.id DESC`,
      )
      .all(...params) as unknown as WorkOrderRow[];

    const orders = rows.map(mapRow);
    const summary: WorkOrderSummaryDTO = {
      total: orders.length,
      pendientes: orders.filter((o) => o.estadoServicio === "PENDIENTE").length,
      programados: orders.filter((o) => o.estadoServicio === "PROGRAMADO")
        .length,
      enProceso: orders.filter((o) => o.estadoServicio === "EN_PROCESO").length,
      realizados: orders.filter((o) => o.estadoServicio === "REALIZADO").length,
      cancelados: orders.filter((o) => o.estadoServicio === "CANCELADO").length,
    };

    return { orders, summary };
  }

  findById(detailId: number): WorkOrderDTO | undefined {
    const row = this.db
      .prepare(
        `SELECT vd.id, vd.venta_id, v.folio, v.fecha_venta, v.estado_venta,
                c.nombre AS cliente_nombre, vd.servicio_id, vd.servicio_nombre_snap,
                vd.precio_aplicado, vd.trabajador_id, t.nombre AS trabajador_nombre,
                vd.fecha_programada, vd.estado_servicio, vd.fecha_realizacion
         FROM venta_detalles vd
         JOIN ventas v ON v.id = vd.venta_id
         LEFT JOIN clientes c ON c.id = v.cliente_id
         LEFT JOIN trabajadores t ON t.id = vd.trabajador_id
         WHERE vd.id = ?`,
      )
      .get(detailId) as WorkOrderRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  updateStatus(
    detailId: number,
    estado: ServiceExecutionStatus,
    actorId: number,
  ): WorkOrderDTO | undefined {
    const fechaRealizacion =
      estado === "REALIZADO" ? new Date().toISOString() : null;
    const confirmadoPor = estado === "REALIZADO" ? actorId : null;

    this.db
      .prepare(
        `UPDATE venta_detalles
         SET estado_servicio = ?,
             fecha_realizacion = ?,
             confirmado_por = ?
         WHERE id = ?`,
      )
      .run(estado, fechaRealizacion, confirmadoPor, detailId);

    return this.findById(detailId);
  }
}
