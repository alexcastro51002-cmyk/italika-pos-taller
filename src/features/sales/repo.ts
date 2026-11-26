import type { DatabaseSync } from "node:sqlite";
import type {
  ClientDTO,
  PaymentStatus,
  SaleDTO,
  SaleDetailDTO,
  SaleStatus,
  ServiceExecutionStatus,
  WorkerDTO,
} from "../../shared/types.js";
import type { CreateClientInput, ListSalesQuery } from "./schema.js";

interface WorkerRow {
  id: number;
  usuario_id: number | null;
  nombre: string;
  telefono: string;
  activo: number;
}

interface ClientRow {
  id: number;
  nombre: string;
  telefono: string;
  correo: string;
}

interface SaleRow {
  id: number;
  folio: string;
  cliente_id: number | null;
  cliente_nombre: string | null;
  registrado_por: number;
  registrado_por_nombre: string;
  fecha_venta: string;
  subtotal: number;
  descuento_autorizado: number;
  total: number;
  pagado: number;
  estado_venta: SaleStatus;
  motivo_cancelacion: string | null;
  cancelado_en: string | null;
}

interface SaleDetailRow {
  id: number;
  venta_id: number;
  servicio_id: number;
  servicio_nombre_snap: string;
  precio_aplicado: number;
  trabajador_id: number | null;
  trabajador_nombre: string | null;
  fecha_programada: string | null;
  estado_servicio: ServiceExecutionStatus;
  fecha_realizacion: string | null;
}

function derivePaymentStatus(total: number, pagado: number): PaymentStatus {
  if (total - pagado <= 0.001) return "LIQUIDADA";
  if (pagado > 0.001) return "PARCIALMENTE_PAGADA";
  return "PENDIENTE";
}

export class SalesRepository {
  constructor(private readonly db: DatabaseSync) {}

  listWorkers(includeInactive = false): WorkerDTO[] {
    const where = includeInactive ? "" : "WHERE activo = 1";
    const rows = this.db
      .prepare(
        `SELECT id, usuario_id, nombre, telefono, activo FROM trabajadores ${where} ORDER BY nombre ASC`,
      )
      .all() as unknown as WorkerRow[];
    return rows.map((r) => ({
      id: r.id,
      usuarioId: r.usuario_id,
      nombre: r.nombre,
      telefono: r.telefono,
      activo: r.activo === 1,
    }));
  }

  findActiveWorker(id: number): WorkerDTO | undefined {
    const row = this.db
      .prepare(
        "SELECT id, usuario_id, nombre, telefono, activo FROM trabajadores WHERE id = ? AND activo = 1",
      )
      .get(id) as WorkerRow | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      usuarioId: row.usuario_id,
      nombre: row.nombre,
      telefono: row.telefono,
      activo: row.activo === 1,
    };
  }

  findActiveService(
    id: number,
  ): { id: number; nombre: string; precioBase: number } | undefined {
    const row = this.db
      .prepare(
        "SELECT id, nombre, precio_base FROM servicios WHERE id = ? AND activo = 1",
      )
      .get(id) as
      | { id: number; nombre: string; precio_base: number }
      | undefined;
    if (!row) return undefined;
    return { id: row.id, nombre: row.nombre, precioBase: row.precio_base };
  }

  listClients(): ClientDTO[] {
    return this.db
      .prepare(
        "SELECT id, nombre, telefono, correo FROM clientes ORDER BY nombre ASC",
      )
      .all() as unknown as ClientRow[];
  }

  findClientById(id: number): ClientDTO | undefined {
    return this.db
      .prepare("SELECT id, nombre, telefono, correo FROM clientes WHERE id = ?")
      .get(id) as ClientRow | undefined;
  }

  createClient(input: CreateClientInput): ClientDTO {
    const res = this.db
      .prepare(
        "INSERT INTO clientes (nombre, telefono, correo) VALUES (?, ?, ?)",
      )
      .run(input.nombre, input.telefono, input.correo);
    const created = this.findClientById(Number(res.lastInsertRowid));
    if (!created) throw new Error("No se pudo recuperar el cliente creado.");
    return created;
  }

  listSales(query: ListSalesQuery): SaleDTO[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (query.status !== "all") {
      clauses.push("v.estado_venta = ?");
      params.push(query.status);
    }
    if (query.from) {
      clauses.push("v.fecha_venta >= ?");
      params.push(query.from);
    }
    if (query.to) {
      clauses.push("v.fecha_venta <= ?");
      params.push(query.to);
    }
    if (query.serviceId) {
      clauses.push(
        "EXISTS (SELECT 1 FROM venta_detalles vd WHERE vd.venta_id = v.id AND vd.servicio_id = ?)",
      );
      params.push(query.serviceId);
    }
    if (query.workerId) {
      clauses.push(
        "EXISTS (SELECT 1 FROM venta_detalles vd WHERE vd.venta_id = v.id AND vd.trabajador_id = ?)",
      );
      params.push(query.workerId);
    }
    if (query.q) {
      const term = `%${query.q}%`;
      clauses.push(
        `(LOWER(v.folio) LIKE LOWER(?)
          OR LOWER(COALESCE(c.nombre, '')) LIKE LOWER(?)
          OR EXISTS (
            SELECT 1 FROM venta_detalles vd
            LEFT JOIN trabajadores t ON t.id = vd.trabajador_id
            WHERE vd.venta_id = v.id
              AND (LOWER(vd.servicio_nombre_snap) LIKE LOWER(?) OR LOWER(COALESCE(t.nombre, '')) LIKE LOWER(?))
          ))`,
      );
      params.push(term, term, term, term);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT v.id, v.folio, v.cliente_id, c.nombre AS cliente_nombre,
                v.registrado_por, u.nombre AS registrado_por_nombre,
                v.fecha_venta, v.subtotal, v.descuento_autorizado, v.total,
                COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.venta_id = v.id), 0) AS pagado,
                v.estado_venta, v.motivo_cancelacion, v.cancelado_en
         FROM ventas v
         LEFT JOIN clientes c ON c.id = v.cliente_id
         JOIN usuarios u ON u.id = v.registrado_por
         ${where}
         ORDER BY v.fecha_venta DESC, v.id DESC`,
      )
      .all(...params) as unknown as SaleRow[];

    return rows.map((row) => this.hydrateSale(row));
  }

  findSaleById(id: number): SaleDTO | undefined {
    const row = this.db
      .prepare(
        `SELECT v.id, v.folio, v.cliente_id, c.nombre AS cliente_nombre,
                v.registrado_por, u.nombre AS registrado_por_nombre,
                v.fecha_venta, v.subtotal, v.descuento_autorizado, v.total,
                COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.venta_id = v.id), 0) AS pagado,
                v.estado_venta, v.motivo_cancelacion, v.cancelado_en
         FROM ventas v
         LEFT JOIN clientes c ON c.id = v.cliente_id
         JOIN usuarios u ON u.id = v.registrado_por
         WHERE v.id = ?`,
      )
      .get(id) as SaleRow | undefined;
    return row ? this.hydrateSale(row) : undefined;
  }

  private hydrateSale(row: SaleRow): SaleDTO {
    const detailRows = this.db
      .prepare(
        `SELECT vd.id, vd.venta_id, vd.servicio_id, vd.servicio_nombre_snap,
                vd.precio_aplicado, vd.trabajador_id, t.nombre AS trabajador_nombre,
                vd.fecha_programada, vd.estado_servicio, vd.fecha_realizacion
         FROM venta_detalles vd
         LEFT JOIN trabajadores t ON t.id = vd.trabajador_id
         WHERE vd.venta_id = ?
         ORDER BY vd.id ASC`,
      )
      .all(row.id) as unknown as SaleDetailRow[];

    const detalles: SaleDetailDTO[] = detailRows.map((d) => ({
      id: d.id,
      ventaId: d.venta_id,
      servicioId: d.servicio_id,
      servicioNombre: d.servicio_nombre_snap,
      precioAplicado: d.precio_aplicado,
      trabajadorId: d.trabajador_id,
      trabajadorNombre: d.trabajador_nombre,
      fechaProgramada: d.fecha_programada,
      estadoServicio: d.estado_servicio,
      fechaRealizacion: d.fecha_realizacion,
    }));

    const pagado = Math.max(0, Number(row.pagado.toFixed(2)));
    const saldoPendiente = Math.max(0, Number((row.total - pagado).toFixed(2)));

    return {
      id: row.id,
      folio: row.folio,
      clienteId: row.cliente_id,
      clienteNombre: row.cliente_nombre,
      registradoPor: row.registrado_por,
      registradoPorNombre: row.registrado_por_nombre,
      fechaVenta: row.fecha_venta,
      subtotal: row.subtotal,
      descuentoAutorizado: row.descuento_autorizado,
      total: row.total,
      pagado,
      saldoPendiente,
      estadoVenta: row.estado_venta,
      estadoPago: derivePaymentStatus(row.total, pagado),
      motivoCancelacion: row.motivo_cancelacion,
      canceladoEn: row.cancelado_en,
      detalles,
    };
  }

  createSale(params: {
    clienteId: number | null;
    newClientName?: string;
    newClientPhone?: string;
    registradoPor: number;
    fechaVenta: string;
    subtotal: number;
    descuentoAutorizado: number;
    total: number;
    items: Array<{
      servicioId: number;
      servicioNombre: string;
      precioAplicado: number;
      trabajadorId: number | null;
      fechaProgramada: string | null;
    }>;
  }): SaleDTO {
    this.db.exec("BEGIN");
    try {
      let resolvedClientId = params.clienteId;
      if (
        resolvedClientId === null &&
        params.newClientName &&
        params.newClientName.length > 0
      ) {
        const cliRes = this.db
          .prepare(
            "INSERT INTO clientes (nombre, telefono, correo) VALUES (?, ?, '')",
          )
          .run(params.newClientName, params.newClientPhone ?? "");
        resolvedClientId = Number(cliRes.lastInsertRowid);
      }

      const seqRow = this.db
        .prepare("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ventas")
        .get() as { next_id: number };
      const dateCompact = params.fechaVenta.replaceAll("-", "");
      const folio = `V-${dateCompact}-${String(seqRow.next_id).padStart(4, "0")}`;

      const saleRes = this.db
        .prepare(
          `INSERT INTO ventas (
            folio, cliente_id, registrado_por, fecha_venta,
            subtotal, descuento_autorizado, total, estado_venta
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'VIGENTE')`,
        )
        .run(
          folio,
          resolvedClientId,
          params.registradoPor,
          params.fechaVenta,
          params.subtotal,
          params.descuentoAutorizado,
          params.total,
        );
      const ventaId = Number(saleRes.lastInsertRowid);

      const insertDetail = this.db.prepare(
        `INSERT INTO venta_detalles (
          venta_id, servicio_id, servicio_nombre_snap, precio_aplicado,
          trabajador_id, fecha_programada, estado_servicio
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const item of params.items) {
        const status = item.fechaProgramada ? "PROGRAMADO" : "PENDIENTE";
        insertDetail.run(
          ventaId,
          item.servicioId,
          item.servicioNombre,
          item.precioAplicado,
          item.trabajadorId,
          item.fechaProgramada,
          status,
        );
      }

      this.db.exec("COMMIT");
      const created = this.findSaleById(ventaId);
      if (!created) throw new Error("No se pudo recuperar la venta creada.");
      return created;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  cancelSale(ventaId: number, canceladoPor: number, motivo: string): SaleDTO {
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare(
          `UPDATE ventas
           SET estado_venta = 'CANCELADA',
               motivo_cancelacion = ?,
               cancelado_por = ?,
               cancelado_en = datetime('now')
           WHERE id = ?`,
        )
        .run(motivo, canceladoPor, ventaId);

      this.db
        .prepare(
          `UPDATE venta_detalles
           SET estado_servicio = 'CANCELADO'
           WHERE venta_id = ?`,
        )
        .run(ventaId);

      this.db.exec("COMMIT");
      const updated = this.findSaleById(ventaId);
      if (!updated) throw new Error("Venta no encontrada tras cancelar.");
      return updated;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
}
