import type { DatabaseSync } from "node:sqlite";
import type {
  CommissionMovementDTO,
  CommissionSummaryDTO,
  CommissionsReportDTO,
  IncomeReportDTO,
  PaymentMethod,
  SaleStatus,
  SalesReportDTO,
  ServiceExecutionStatus,
  ServicesReportDTO,
  WorkOrderDTO,
} from "../../shared/types.js";
import type { ReportQuery } from "./schema.js";

function toPeriodKey(
  dateStr: string,
  groupBy: "day" | "week" | "month",
): string {
  if (groupBy === "month") return dateStr.slice(0, 7);
  if (groupBy === "day") return dateStr;
  // Semana ISO aproximada: lunes de la semana
  const dt = new Date(`${dateStr}T00:00:00Z`);
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return `Sem ${dt.toISOString().slice(0, 10)}`;
}

export class ReportsRepository {
  constructor(private readonly db: DatabaseSync) {}

  getSalesReport(query: ReportQuery): SalesReportDTO {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (query.from) {
      clauses.push("v.fecha_venta >= ?");
      params.push(query.from);
    }
    if (query.to) {
      clauses.push("v.fecha_venta <= ?");
      params.push(query.to);
    }
    if (query.responsibleId) {
      clauses.push("v.registrado_por = ?");
      params.push(query.responsibleId);
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

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const saleRows = this.db
      .prepare(
        `SELECT v.id, v.folio, v.fecha_venta, c.nombre AS cliente_nombre,
                u.nombre AS responsable_nombre, v.subtotal, v.descuento_autorizado,
                v.total, v.estado_venta
         FROM ventas v
         LEFT JOIN clientes c ON c.id = v.cliente_id
         JOIN usuarios u ON u.id = v.registrado_por
         ${where}
         ORDER BY v.fecha_venta DESC, v.id DESC`,
      )
      .all(...params) as unknown as Array<{
      id: number;
      folio: string;
      fecha_venta: string;
      cliente_nombre: string | null;
      responsable_nombre: string;
      subtotal: number;
      descuento_autorizado: number;
      total: number;
      estado_venta: SaleStatus;
    }>;

    const validSales = saleRows.filter((s) => s.estado_venta === "VIGENTE");
    const periodMap = new Map<
      string,
      {
        periodo: string;
        cantidad: number;
        subtotal: number;
        descuentos: number;
        total: number;
      }
    >();
    const serviceMap = new Map<
      string,
      { servicioNombre: string; cantidad: number; totalVendido: number }
    >();
    const detalleVentas: SalesReportDTO["detalleVentas"] = [];

    const detailStmt = this.db.prepare(
      `SELECT vd.servicio_nombre_snap, vd.precio_aplicado, t.nombre AS trabajador_nombre
       FROM venta_detalles vd
       LEFT JOIN trabajadores t ON t.id = vd.trabajador_id
       WHERE vd.venta_id = ?`,
    );

    for (const s of saleRows) {
      const details = detailStmt.all(s.id) as unknown as Array<{
        servicio_nombre_snap: string;
        precio_aplicado: number;
        trabajador_nombre: string | null;
      }>;

      detalleVentas.push({
        folio: s.folio,
        fechaVenta: s.fecha_venta,
        clienteNombre: s.cliente_nombre,
        servicios: details.map((d) => d.servicio_nombre_snap).join(", "),
        trabajadores:
          [
            ...new Set(
              details
                .map((d) => d.trabajador_nombre)
                .filter((n): n is string => Boolean(n)),
            ),
          ].join(", ") || "Sin asignar",
        responsableNombre: s.responsable_nombre,
        total: s.total,
        estadoVenta: s.estado_venta,
      });

      if (s.estado_venta !== "VIGENTE") continue;

      const pk = toPeriodKey(s.fecha_venta, query.groupBy);
      const pEntry = periodMap.get(pk) ?? {
        periodo: pk,
        cantidad: 0,
        subtotal: 0,
        descuentos: 0,
        total: 0,
      };
      pEntry.cantidad += 1;
      pEntry.subtotal = Number((pEntry.subtotal + s.subtotal).toFixed(2));
      pEntry.descuentos = Number(
        (pEntry.descuentos + s.descuento_autorizado).toFixed(2),
      );
      pEntry.total = Number((pEntry.total + s.total).toFixed(2));
      periodMap.set(pk, pEntry);

      for (const d of details) {
        const sEntry = serviceMap.get(d.servicio_nombre_snap) ?? {
          servicioNombre: d.servicio_nombre_snap,
          cantidad: 0,
          totalVendido: 0,
        };
        sEntry.cantidad += 1;
        sEntry.totalVendido = Number(
          (sEntry.totalVendido + d.precio_aplicado).toFixed(2),
        );
        serviceMap.set(d.servicio_nombre_snap, sEntry);
      }
    }

    return {
      groupBy: query.groupBy,
      totales: {
        ventasVigentes: validSales.length,
        ventasCanceladas: saleRows.length - validSales.length,
        subtotal: Number(
          validSales.reduce((a, s) => a + s.subtotal, 0).toFixed(2),
        ),
        descuentos: Number(
          validSales.reduce((a, s) => a + s.descuento_autorizado, 0).toFixed(2),
        ),
        totalVendido: Number(
          validSales.reduce((a, s) => a + s.total, 0).toFixed(2),
        ),
      },
      periodos: [...periodMap.values()].sort((a, b) =>
        a.periodo.localeCompare(b.periodo),
      ),
      porServicio: [...serviceMap.values()].sort(
        (a, b) => b.totalVendido - a.totalVendido,
      ),
      detalleVentas,
    };
  }

  getServicesReport(query: ReportQuery): ServicesReportDTO {
    const clauses: string[] = [
      "vd.estado_servicio = 'REALIZADO'",
      "v.estado_venta = 'VIGENTE'",
    ];
    const params: Array<string | number> = [];

    if (query.from) {
      clauses.push(
        "COALESCE(SUBSTR(vd.fecha_realizacion, 1, 10), v.fecha_venta) >= ?",
      );
      params.push(query.from);
    }
    if (query.to) {
      clauses.push(
        "COALESCE(SUBSTR(vd.fecha_realizacion, 1, 10), v.fecha_venta) <= ?",
      );
      params.push(query.to);
    }
    if (query.workerId) {
      clauses.push("vd.trabajador_id = ?");
      params.push(query.workerId);
    }
    if (query.serviceId) {
      clauses.push("vd.servicio_id = ?");
      params.push(query.serviceId);
    }

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
         WHERE ${clauses.join(" AND ")}
         ORDER BY COALESCE(vd.fecha_realizacion, v.fecha_venta) DESC`,
      )
      .all(...params) as unknown as Array<{
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
    }>;

    const detalle: WorkOrderDTO[] = rows.map((r) => ({
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
    }));

    const workerMap = new Map<
      string,
      {
        trabajadorId: number | null;
        trabajadorNombre: string;
        cantidad: number;
        importeServicios: number;
      }
    >();

    for (const d of detalle) {
      const key = String(d.trabajadorId ?? "none");
      const entry = workerMap.get(key) ?? {
        trabajadorId: d.trabajadorId,
        trabajadorNombre: d.trabajadorNombre ?? "Sin asignar",
        cantidad: 0,
        importeServicios: 0,
      };
      entry.cantidad += 1;
      entry.importeServicios = Number(
        (entry.importeServicios + d.precioAplicado).toFixed(2),
      );
      workerMap.set(key, entry);
    }

    return {
      totalRealizados: detalle.length,
      porTrabajador: [...workerMap.values()].sort(
        (a, b) => b.cantidad - a.cantidad,
      ),
      detalle,
    };
  }

  getIncomeReport(query: ReportQuery): IncomeReportDTO {
    const payClauses: string[] = [];
    const payParams: Array<string | number> = [];

    if (query.from) {
      payClauses.push("p.fecha_pago >= ?");
      payParams.push(query.from);
    }
    if (query.to) {
      payClauses.push("p.fecha_pago <= ?");
      payParams.push(query.to);
    }
    if (query.serviceId) {
      payClauses.push(
        "EXISTS (SELECT 1 FROM venta_detalles vd WHERE vd.venta_id = p.venta_id AND vd.servicio_id = ?)",
      );
      payParams.push(query.serviceId);
    }
    if (query.workerId) {
      payClauses.push(
        "EXISTS (SELECT 1 FROM venta_detalles vd WHERE vd.venta_id = p.venta_id AND vd.trabajador_id = ?)",
      );
      payParams.push(query.workerId);
    }

    const payWhere =
      payClauses.length > 0 ? `WHERE ${payClauses.join(" AND ")}` : "";
    const payRows = this.db
      .prepare(
        `SELECT p.id, v.folio, c.nombre AS cliente_nombre, p.fecha_pago,
                p.tipo, p.metodo_pago, p.monto, u.nombre AS registrado_por_nombre
         FROM pagos p
         JOIN ventas v ON v.id = p.venta_id
         LEFT JOIN clientes c ON c.id = v.cliente_id
         JOIN usuarios u ON u.id = p.registrado_por
         ${payWhere}
         ORDER BY p.fecha_pago DESC, p.id DESC`,
      )
      .all(...payParams) as unknown as Array<{
      id: number;
      folio: string;
      cliente_nombre: string | null;
      fecha_pago: string;
      tipo: "PAGO" | "REEMBOLSO";
      metodo_pago: PaymentMethod;
      monto: number;
      registrado_por_nombre: string;
    }>;

    const methodMap = new Map<
      PaymentMethod,
      {
        metodoPago: PaymentMethod;
        cobrado: number;
        reembolsado: number;
        neto: number;
        movimientos: number;
      }
    >();

    for (const r of payRows) {
      const entry = methodMap.get(r.metodo_pago) ?? {
        metodoPago: r.metodo_pago,
        cobrado: 0,
        reembolsado: 0,
        neto: 0,
        movimientos: 0,
      };
      if (r.tipo === "PAGO") {
        entry.cobrado = Number((entry.cobrado + r.monto).toFixed(2));
      } else {
        entry.reembolsado = Number(
          (entry.reembolsado + Math.abs(r.monto)).toFixed(2),
        );
      }
      entry.neto = Number((entry.cobrado - entry.reembolsado).toFixed(2));
      entry.movimientos += 1;
      methodMap.set(r.metodo_pago, entry);
    }

    const saleClauses: string[] = ["v.estado_venta = 'VIGENTE'"];
    const saleParams: Array<string | number> = [];
    if (query.from) {
      saleClauses.push("v.fecha_venta >= ?");
      saleParams.push(query.from);
    }
    if (query.to) {
      saleClauses.push("v.fecha_venta <= ?");
      saleParams.push(query.to);
    }
    const saleStats = this.db
      .prepare(
        `SELECT COALESCE(SUM(v.total), 0) AS vendido,
                COALESCE((
                  SELECT SUM(p.monto)
                  FROM pagos p
                  JOIN ventas vv ON vv.id = p.venta_id
                  WHERE ${saleClauses.map((c) => c.replace("v.", "vv.")).join(" AND ")}
                ), 0) AS cobrado_vigente
         FROM ventas v
         WHERE ${saleClauses.join(" AND ")}`,
      )
      .get(...saleParams, ...saleParams) as {
      vendido: number;
      cobrado_vigente: number;
    };

    const totalCobradoNeto = Number(
      payRows.reduce((acc, r) => acc + r.monto, 0).toFixed(2),
    );
    const totalVendidoVigente = Number(saleStats.vendido.toFixed(2));
    const saldoPendienteTotal = Math.max(
      0,
      Number((totalVendidoVigente - saleStats.cobrado_vigente).toFixed(2)),
    );

    return {
      totales: {
        totalVendidoVigente,
        totalCobradoNeto,
        saldoPendienteTotal,
      },
      porMetodo: [...methodMap.values()],
      movimientos: payRows.map((r) => ({
        id: r.id,
        folio: r.folio,
        clienteNombre: r.cliente_nombre,
        fechaPago: r.fecha_pago,
        tipo: r.tipo,
        metodoPago: r.metodo_pago,
        monto: r.monto,
        registradoPorNombre: r.registrado_por_nombre,
      })),
    };
  }

  getCommissionsReport(query: ReportQuery): CommissionsReportDTO {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (query.from) {
      clauses.push("v.fecha_venta >= ?");
      params.push(query.from);
    }
    if (query.to) {
      clauses.push("v.fecha_venta <= ?");
      params.push(query.to);
    }
    if (query.workerId) {
      clauses.push(
        "mc.beneficiario_tipo = 'TRABAJADOR' AND mc.beneficiario_id = ?",
      );
      params.push(query.workerId);
    }
    if (query.serviceId) {
      clauses.push("vd.servicio_id = ?");
      params.push(query.serviceId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT mc.id, mc.beneficiario_tipo, mc.beneficiario_id,
                CASE
                  WHEN mc.beneficiario_tipo = 'TRABAJADOR' THEN COALESCE(t.nombre, 'Trabajador')
                  ELSE COALESCE(u.nombre, 'Secretaria')
                END AS beneficiario_nombre,
                mc.venta_id, v.folio, v.fecha_venta,
                mc.venta_detalle_id, vd.servicio_nombre_snap AS servicio_nombre,
                mc.base_elegible, mc.porcentaje_aplicado, mc.monto,
                mc.tipo_movimiento, mc.fecha_registro
         FROM movimientos_comision mc
         JOIN ventas v ON v.id = mc.venta_id
         LEFT JOIN venta_detalles vd ON vd.id = mc.venta_detalle_id
         LEFT JOIN trabajadores t ON mc.beneficiario_tipo = 'TRABAJADOR' AND t.id = mc.beneficiario_id
         LEFT JOIN usuarios u ON mc.beneficiario_tipo = 'SECRETARIA' AND u.id = mc.beneficiario_id
         ${where}
         ORDER BY mc.id DESC`,
      )
      .all(...params) as unknown as Array<{
      id: number;
      beneficiario_tipo: "TRABAJADOR" | "SECRETARIA";
      beneficiario_id: number;
      beneficiario_nombre: string;
      venta_id: number;
      folio: string;
      fecha_venta: string;
      venta_detalle_id: number | null;
      servicio_nombre: string | null;
      base_elegible: number;
      porcentaje_aplicado: number;
      monto: number;
      tipo_movimiento: "DEVENGADA" | "AJUSTE_CANCELACION" | "AJUSTE_REEMBOLSO";
      fecha_registro: string;
    }>;

    const movimientos: CommissionMovementDTO[] = rows.map((r) => ({
      id: r.id,
      beneficiarioTipo: r.beneficiario_tipo,
      beneficiarioId: r.beneficiario_id,
      beneficiarioNombre: r.beneficiario_nombre,
      ventaId: r.venta_id,
      folio: r.folio,
      fechaVenta: r.fecha_venta,
      ventaDetalleId: r.venta_detalle_id,
      servicioNombre: r.servicio_nombre,
      baseElegible: r.base_elegible,
      porcentajeAplicado: r.porcentaje_aplicado,
      monto: r.monto,
      tipoMovimiento: r.tipo_movimiento,
      fechaRegistro: r.fecha_registro,
    }));

    const map = new Map<string, CommissionSummaryDTO>();
    for (const m of movimientos) {
      const key = `${m.beneficiarioTipo}:${m.beneficiarioId}`;
      const entry = map.get(key) ?? {
        beneficiarioTipo: m.beneficiarioTipo,
        beneficiarioId: m.beneficiarioId,
        beneficiarioNombre: m.beneficiarioNombre,
        devengado: 0,
        ajustes: 0,
        neto: 0,
        operaciones: 0,
      };
      if (m.tipoMovimiento === "DEVENGADA") {
        entry.devengado = Number((entry.devengado + m.monto).toFixed(2));
        entry.operaciones += 1;
      } else {
        entry.ajustes = Number((entry.ajustes + m.monto).toFixed(2));
      }
      entry.neto = Number((entry.devengado + entry.ajustes).toFixed(2));
      map.set(key, entry);
    }

    const all = [...map.values()];
    const trabajadores = all.filter((s) => s.beneficiarioTipo === "TRABAJADOR");
    const secretaria = all.filter((s) => s.beneficiarioTipo === "SECRETARIA");
    const trabajadoresNeto = Number(
      trabajadores.reduce((a, s) => a + s.neto, 0).toFixed(2),
    );
    const secretariaNeto = Number(
      secretaria.reduce((a, s) => a + s.neto, 0).toFixed(2),
    );

    return {
      totales: {
        trabajadoresNeto,
        secretariaNeto,
        totalGeneral: Number((trabajadoresNeto + secretariaNeto).toFixed(2)),
      },
      trabajadores,
      secretaria,
      movimientos,
    };
  }
}
