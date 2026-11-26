import type { DatabaseSync } from "node:sqlite";
import type { DomainEventBus } from "../../shared/events.js";
import type {
  CommissionBase,
  CommissionConfigDTO,
  Role,
} from "../../shared/types.js";

interface SaleSnapshot {
  id: number;
  registrado_por: number;
  registrado_rol: Role;
  subtotal: number;
  descuento_autorizado: number;
  total: number;
  estado_venta: "VIGENTE" | "CANCELADA";
  pagado: number;
}

interface DetailSnapshot {
  id: number;
  venta_id: number;
  servicio_id: number;
  precio_aplicado: number;
  trabajador_id: number | null;
  estado_servicio: string;
}

function loadConfig(db: DatabaseSync): CommissionConfigDTO {
  const row = db
    .prepare("SELECT * FROM configuracion_negocio WHERE id = 1")
    .get() as {
    disparador_comision_trab: CommissionConfigDTO["disparadorTrabajador"];
    disparador_comision_sec: CommissionConfigDTO["disparadorSecretaria"];
    base_elegible: CommissionBase;
    sec_solo_ventas_propias: number;
    tasa_trabajador_global: number;
    tasa_secretaria_global: number;
  };
  return {
    disparadorTrabajador: row.disparador_comision_trab,
    disparadorSecretaria: row.disparador_comision_sec,
    baseElegible: row.base_elegible,
    secSoloVentasPropias: row.sec_solo_ventas_propias === 1,
    tasaTrabajadorGlobal: row.tasa_trabajador_global,
    tasaSecretariaGlobal: row.tasa_secretaria_global,
  };
}

function loadSale(db: DatabaseSync, ventaId: number): SaleSnapshot | undefined {
  return db
    .prepare(
      `SELECT v.id, v.registrado_por, u.rol AS registrado_rol,
              v.subtotal, v.descuento_autorizado, v.total, v.estado_venta,
              COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.venta_id = v.id), 0) AS pagado
       FROM ventas v
       JOIN usuarios u ON u.id = v.registrado_por
       WHERE v.id = ?`,
    )
    .get(ventaId) as SaleSnapshot | undefined;
}

function loadDetails(db: DatabaseSync, ventaId: number): DetailSnapshot[] {
  return db
    .prepare(
      `SELECT id, venta_id, servicio_id, precio_aplicado, trabajador_id, estado_servicio
       FROM venta_detalles WHERE venta_id = ? ORDER BY id ASC`,
    )
    .all(ventaId) as unknown as DetailSnapshot[];
}

function resolveWorkerRate(
  db: DatabaseSync,
  trabajadorId: number,
  servicioId: number,
  globalRate: number,
): number {
  const specific = db
    .prepare(
      `SELECT porcentaje FROM reglas_comision
       WHERE activo = 1 AND trabajador_id = ? AND servicio_id = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(trabajadorId, servicioId) as { porcentaje: number } | undefined;
  if (specific) return specific.porcentaje;

  const byWorker = db
    .prepare(
      `SELECT porcentaje FROM reglas_comision
       WHERE activo = 1 AND trabajador_id = ? AND servicio_id IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get(trabajadorId) as { porcentaje: number } | undefined;
  if (byWorker) return byWorker.porcentaje;

  const byService = db
    .prepare(
      `SELECT porcentaje FROM reglas_comision
       WHERE activo = 1 AND trabajador_id IS NULL AND servicio_id = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(servicioId) as { porcentaje: number } | undefined;
  if (byService) return byService.porcentaje;

  return globalRate;
}

function computeSaleBase(sale: SaleSnapshot, strategy: CommissionBase): number {
  if (strategy === "BRUTO") return sale.subtotal;
  if (strategy === "COBRADO_REAL") {
    return Math.max(0, Math.min(sale.total, sale.pagado));
  }
  return sale.total;
}

function computeDetailBase(
  sale: SaleSnapshot,
  detail: DetailSnapshot,
  strategy: CommissionBase,
): number {
  if (strategy === "BRUTO" || sale.subtotal <= 0) {
    return detail.precio_aplicado;
  }
  const ratio = detail.precio_aplicado / sale.subtotal;
  return Number((computeSaleBase(sale, strategy) * ratio).toFixed(2));
}

function accrueWorkerDetail(
  db: DatabaseSync,
  sale: SaleSnapshot,
  detail: DetailSnapshot,
  cfg: CommissionConfigDTO,
): void {
  if (sale.estado_venta !== "VIGENTE" || detail.trabajador_id === null) return;
  const exists = db
    .prepare(
      `SELECT 1 FROM movimientos_comision
       WHERE beneficiario_tipo = 'TRABAJADOR'
         AND venta_detalle_id = ?
         AND tipo_movimiento = 'DEVENGADA'`,
    )
    .get(detail.id);
  if (exists) return;

  const rate = resolveWorkerRate(
    db,
    detail.trabajador_id,
    detail.servicio_id,
    cfg.tasaTrabajadorGlobal,
  );
  const base = computeDetailBase(sale, detail, cfg.baseElegible);
  const monto = Number(((base * rate) / 100).toFixed(2));
  if (monto <= 0) return;

  db.prepare(
    `INSERT INTO movimientos_comision (
      beneficiario_tipo, beneficiario_id, venta_id, venta_detalle_id,
      base_elegible, porcentaje_aplicado, monto, tipo_movimiento
    ) VALUES ('TRABAJADOR', ?, ?, ?, ?, ?, ?, 'DEVENGADA')`,
  ).run(detail.trabajador_id, sale.id, detail.id, base, rate, monto);
}

function accrueSecretarySale(
  db: DatabaseSync,
  sale: SaleSnapshot,
  cfg: CommissionConfigDTO,
): void {
  if (sale.estado_venta !== "VIGENTE") return;
  if (cfg.secSoloVentasPropias && sale.registrado_rol !== "SECRETARIA") {
    return;
  }
  const exists = db
    .prepare(
      `SELECT 1 FROM movimientos_comision
       WHERE beneficiario_tipo = 'SECRETARIA'
         AND venta_id = ?
         AND tipo_movimiento = 'DEVENGADA'`,
    )
    .get(sale.id);
  if (exists) return;

  const base = computeSaleBase(sale, cfg.baseElegible);
  const rate = cfg.tasaSecretariaGlobal;
  const monto = Number(((base * rate) / 100).toFixed(2));
  if (monto <= 0) return;

  db.prepare(
    `INSERT INTO movimientos_comision (
      beneficiario_tipo, beneficiario_id, venta_id, venta_detalle_id,
      base_elegible, porcentaje_aplicado, monto, tipo_movimiento
    ) VALUES ('SECRETARIA', ?, ?, NULL, ?, ?, ?, 'DEVENGADA')`,
  ).run(sale.registrado_por, sale.id, base, rate, monto);
}

function reverseSaleCommissions(
  db: DatabaseSync,
  ventaId: number,
  tipoAjuste: "AJUSTE_CANCELACION" | "AJUSTE_REEMBOLSO",
): void {
  const rows = db
    .prepare(
      `SELECT beneficiario_tipo, beneficiario_id, venta_id, venta_detalle_id,
              MAX(base_elegible) AS base_elegible,
              MAX(porcentaje_aplicado) AS porcentaje_aplicado,
              SUM(monto) AS saldo_comision
       FROM movimientos_comision
       WHERE venta_id = ?
       GROUP BY beneficiario_tipo, beneficiario_id, venta_id, venta_detalle_id
       HAVING SUM(monto) > 0.001`,
    )
    .all(ventaId) as unknown as Array<{
    beneficiario_tipo: "TRABAJADOR" | "SECRETARIA";
    beneficiario_id: number;
    venta_id: number;
    venta_detalle_id: number | null;
    base_elegible: number;
    porcentaje_aplicado: number;
    saldo_comision: number;
  }>;

  const insert = db.prepare(
    `INSERT INTO movimientos_comision (
      beneficiario_tipo, beneficiario_id, venta_id, venta_detalle_id,
      base_elegible, porcentaje_aplicado, monto, tipo_movimiento
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const r of rows) {
    insert.run(
      r.beneficiario_tipo,
      r.beneficiario_id,
      r.venta_id,
      r.venta_detalle_id,
      r.base_elegible,
      r.porcentaje_aplicado,
      -Number(r.saldo_comision.toFixed(2)),
      tipoAjuste,
    );
  }
}

export function registerCommissionListeners(
  db: DatabaseSync,
  eventBus: DomainEventBus,
): void {
  eventBus.on("VentaRegistrada", (event) => {
    const cfg = loadConfig(db);
    const sale = loadSale(db, event.ventaId);
    if (!sale) return;

    if (cfg.disparadorTrabajador === "AL_VENDER") {
      for (const detail of loadDetails(db, sale.id)) {
        accrueWorkerDetail(db, sale, detail, cfg);
      }
    }
    if (cfg.disparadorSecretaria === "AL_VENDER") {
      accrueSecretarySale(db, sale, cfg);
    }
  });

  eventBus.on("ServicioRealizado", (event) => {
    const cfg = loadConfig(db);
    const sale = loadSale(db, event.ventaId);
    if (!sale) return;

    if (cfg.disparadorTrabajador === "AL_REALIZAR") {
      const detail = loadDetails(db, sale.id).find(
        (d) => d.id === event.ventaDetalleId,
      );
      if (detail) {
        accrueWorkerDetail(db, sale, detail, cfg);
      }
    }
    if (cfg.disparadorSecretaria === "AL_REALIZAR") {
      const allDone = loadDetails(db, sale.id).every(
        (d) => d.estado_servicio === "REALIZADO",
      );
      if (allDone) {
        accrueSecretarySale(db, sale, cfg);
      }
    }
  });

  eventBus.on("PagoRegistrado", (event) => {
    if (!event.liquidada) return;
    const cfg = loadConfig(db);
    const sale = loadSale(db, event.ventaId);
    if (!sale) return;

    if (cfg.disparadorTrabajador === "AL_LIQUIDAR") {
      for (const detail of loadDetails(db, sale.id)) {
        accrueWorkerDetail(db, sale, detail, cfg);
      }
    }
    if (cfg.disparadorSecretaria === "AL_LIQUIDAR") {
      accrueSecretarySale(db, sale, cfg);
    }
  });

  eventBus.on("VentaCancelada", (event) => {
    reverseSaleCommissions(db, event.ventaId, "AJUSTE_CANCELACION");
  });

  eventBus.on("PagoReembolsado", (event) => {
    const sale = loadSale(db, event.ventaId);
    if (!sale) return;
    if (sale.pagado <= 0.001) {
      reverseSaleCommissions(db, event.ventaId, "AJUSTE_REEMBOLSO");
    }
  });
}
