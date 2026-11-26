import type { DatabaseSync } from "node:sqlite";
import type {
  PaymentAccountSummaryDTO,
  PaymentDTO,
  PaymentMethod,
  PaymentStatus,
  ReceiptDTO,
  SaleStatus,
  ServiceExecutionStatus,
} from "../../shared/types.js";

interface AccountRow {
  venta_id: number;
  folio: string;
  fecha_venta: string;
  cliente_nombre: string | null;
  registrado_por_nombre: string;
  subtotal: number;
  descuento_autorizado: number;
  total: number;
  pagado: number;
  estado_venta: SaleStatus;
}

interface PaymentRow {
  id: number;
  venta_id: number;
  monto: number;
  tipo: "PAGO" | "REEMBOLSO";
  metodo_pago: PaymentMethod;
  fecha_pago: string;
  registrado_por: number;
  registrado_por_nombre: string;
}

interface ReceiptItemRow {
  servicio_nombre_snap: string;
  trabajador_nombre: string | null;
  precio_aplicado: number;
  fecha_programada: string | null;
  estado_servicio: ServiceExecutionStatus;
}

function derivePaymentStatus(total: number, pagado: number): PaymentStatus {
  if (total - pagado <= 0.001) return "LIQUIDADA";
  if (pagado > 0.001) return "PARCIALMENTE_PAGADA";
  return "PENDIENTE";
}

export class PaymentsRepository {
  constructor(private readonly db: DatabaseSync) {}

  listAccountSummaries(): PaymentAccountSummaryDTO[] {
    const rows = this.db
      .prepare(
        `SELECT v.id AS venta_id, v.folio, v.fecha_venta,
                c.nombre AS cliente_nombre, u.nombre AS registrado_por_nombre,
                v.subtotal, v.descuento_autorizado, v.total,
                COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.venta_id = v.id), 0) AS pagado,
                v.estado_venta
         FROM ventas v
         LEFT JOIN clientes c ON c.id = v.cliente_id
         JOIN usuarios u ON u.id = v.registrado_por
         ORDER BY v.fecha_venta DESC, v.id DESC`,
      )
      .all() as unknown as AccountRow[];

    return rows.map((r) => {
      const pagado = Math.max(0, Number(r.pagado.toFixed(2)));
      const saldoPendiente = Math.max(0, Number((r.total - pagado).toFixed(2)));
      return {
        ventaId: r.venta_id,
        folio: r.folio,
        fechaVenta: r.fecha_venta,
        clienteNombre: r.cliente_nombre,
        total: r.total,
        pagado,
        saldoPendiente,
        estadoVenta: r.estado_venta,
        estadoPago: derivePaymentStatus(r.total, pagado),
      };
    });
  }

  findSaleAccount(ventaId: number): AccountRow | undefined {
    return this.db
      .prepare(
        `SELECT v.id AS venta_id, v.folio, v.fecha_venta,
                c.nombre AS cliente_nombre, u.nombre AS registrado_por_nombre,
                v.subtotal, v.descuento_autorizado, v.total,
                COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.venta_id = v.id), 0) AS pagado,
                v.estado_venta
         FROM ventas v
         LEFT JOIN clientes c ON c.id = v.cliente_id
         JOIN usuarios u ON u.id = v.registrado_por
         WHERE v.id = ?`,
      )
      .get(ventaId) as AccountRow | undefined;
  }

  listPaymentsBySale(ventaId: number): PaymentDTO[] {
    const rows = this.db
      .prepare(
        `SELECT p.id, p.venta_id, p.monto, p.tipo, p.metodo_pago,
                p.fecha_pago, p.registrado_por, u.nombre AS registrado_por_nombre
         FROM pagos p
         JOIN usuarios u ON u.id = p.registrado_por
         WHERE p.venta_id = ?
         ORDER BY p.fecha_pago ASC, p.id ASC`,
      )
      .all(ventaId) as unknown as PaymentRow[];
    return rows.map((r) => ({
      id: r.id,
      ventaId: r.venta_id,
      monto: r.monto,
      tipo: r.tipo,
      metodoPago: r.metodo_pago,
      fechaPago: r.fecha_pago,
      registradoPor: r.registrado_por,
      registradoPorNombre: r.registrado_por_nombre,
    }));
  }

  insertPayment(params: {
    ventaId: number;
    monto: number;
    tipo: "PAGO" | "REEMBOLSO";
    metodoPago: PaymentMethod;
    fechaPago: string;
    registradoPor: number;
  }): PaymentDTO {
    const res = this.db
      .prepare(
        `INSERT INTO pagos (venta_id, monto, tipo, metodo_pago, fecha_pago, registrado_por)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.ventaId,
        params.monto,
        params.tipo,
        params.metodoPago,
        params.fechaPago,
        params.registradoPor,
      );
    const id = Number(res.lastInsertRowid);
    const created = this.listPaymentsBySale(params.ventaId).find(
      (p) => p.id === id,
    );
    if (!created) throw new Error("No se pudo recuperar el pago registrado.");
    return created;
  }

  getReceipt(ventaId: number): ReceiptDTO | undefined {
    const account = this.findSaleAccount(ventaId);
    if (!account) return undefined;

    const itemRows = this.db
      .prepare(
        `SELECT vd.servicio_nombre_snap, t.nombre AS trabajador_nombre,
                vd.precio_aplicado, vd.fecha_programada, vd.estado_servicio
         FROM venta_detalles vd
         LEFT JOIN trabajadores t ON t.id = vd.trabajador_id
         WHERE vd.venta_id = ?
         ORDER BY vd.id ASC`,
      )
      .all(ventaId) as unknown as ReceiptItemRow[];

    const pagos = this.listPaymentsBySale(ventaId);
    const pagado = Math.max(0, Number(account.pagado.toFixed(2)));
    const saldoPendiente = Math.max(
      0,
      Number((account.total - pagado).toFixed(2)),
    );

    return {
      folio: account.folio,
      fechaVenta: account.fecha_venta,
      clienteNombre: account.cliente_nombre ?? "Público en general",
      registradoPorNombre: account.registrado_por_nombre,
      estadoVenta: account.estado_venta,
      subtotal: account.subtotal,
      descuentoAutorizado: account.descuento_autorizado,
      total: account.total,
      pagado,
      saldoPendiente,
      estadoPago: derivePaymentStatus(account.total, pagado),
      servicios: itemRows.map((i) => ({
        servicioNombre: i.servicio_nombre_snap,
        trabajadorNombre: i.trabajador_nombre,
        precioAplicado: i.precio_aplicado,
        fechaProgramada: i.fecha_programada,
        estadoServicio: i.estado_servicio,
      })),
      pagos,
    };
  }
}
