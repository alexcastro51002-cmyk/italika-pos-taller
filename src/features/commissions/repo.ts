import type { DatabaseSync } from "node:sqlite";
import type {
  CommissionBase,
  CommissionConfigDTO,
  CommissionMovementDTO,
  CommissionRuleDTO,
  CommissionSummaryDTO,
  CommissionTrigger,
} from "../../shared/types.js";
import type {
  CreateCommissionRuleInput,
  ListCommissionsQuery,
  UpdateCommissionConfigInput,
} from "./schema.js";

interface ConfigRow {
  disparador_comision_trab: CommissionTrigger;
  disparador_comision_sec: CommissionTrigger;
  base_elegible: CommissionBase;
  sec_solo_ventas_propias: number;
  tasa_trabajador_global: number;
  tasa_secretaria_global: number;
}

interface RuleRow {
  id: number;
  trabajador_id: number | null;
  trabajador_nombre: string | null;
  servicio_id: number | null;
  servicio_nombre: string | null;
  porcentaje: number;
  activo: number;
}

interface MovementRow {
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
}

export class CommissionsRepository {
  constructor(private readonly db: DatabaseSync) {}

  getConfig(): CommissionConfigDTO {
    const row = this.db
      .prepare("SELECT * FROM configuracion_negocio WHERE id = 1")
      .get() as unknown as ConfigRow;
    return {
      disparadorTrabajador: row.disparador_comision_trab,
      disparadorSecretaria: row.disparador_comision_sec,
      baseElegible: row.base_elegible,
      secSoloVentasPropias: row.sec_solo_ventas_propias === 1,
      tasaTrabajadorGlobal: row.tasa_trabajador_global,
      tasaSecretariaGlobal: row.tasa_secretaria_global,
    };
  }

  updateConfig(input: UpdateCommissionConfigInput): CommissionConfigDTO {
    this.db
      .prepare(
        `UPDATE configuracion_negocio
         SET disparador_comision_trab = ?,
             disparador_comision_sec = ?,
             base_elegible = ?,
             sec_solo_ventas_propias = ?,
             tasa_trabajador_global = ?,
             tasa_secretaria_global = ?
         WHERE id = 1`,
      )
      .run(
        input.disparadorTrabajador,
        input.disparadorSecretaria,
        input.baseElegible,
        input.secSoloVentasPropias ? 1 : 0,
        input.tasaTrabajadorGlobal,
        input.tasaSecretariaGlobal,
      );
    return this.getConfig();
  }

  listRules(): CommissionRuleDTO[] {
    const rows = this.db
      .prepare(
        `SELECT rc.id, rc.trabajador_id, t.nombre AS trabajador_nombre,
                rc.servicio_id, s.nombre AS servicio_nombre,
                rc.porcentaje, rc.activo
         FROM reglas_comision rc
         LEFT JOIN trabajadores t ON t.id = rc.trabajador_id
         LEFT JOIN servicios s ON s.id = rc.servicio_id
         WHERE rc.activo = 1
         ORDER BY rc.id DESC`,
      )
      .all() as unknown as RuleRow[];
    return rows.map((r) => ({
      id: r.id,
      trabajadorId: r.trabajador_id,
      trabajadorNombre: r.trabajador_nombre,
      servicioId: r.servicio_id,
      servicioNombre: r.servicio_nombre,
      porcentaje: r.porcentaje,
      activo: r.activo === 1,
    }));
  }

  createRule(input: CreateCommissionRuleInput): CommissionRuleDTO {
    this.db
      .prepare(
        `UPDATE reglas_comision SET activo = 0
         WHERE activo = 1
           AND COALESCE(trabajador_id, -1) = COALESCE(?, -1)
           AND COALESCE(servicio_id, -1) = COALESCE(?, -1)`,
      )
      .run(input.trabajadorId, input.servicioId);

    const res = this.db
      .prepare(
        `INSERT INTO reglas_comision (trabajador_id, servicio_id, porcentaje, activo)
         VALUES (?, ?, ?, 1)`,
      )
      .run(input.trabajadorId, input.servicioId, input.porcentaje);
    const id = Number(res.lastInsertRowid);
    const created = this.listRules().find((r) => r.id === id);
    if (!created) throw new Error("No se pudo recuperar la regla creada.");
    return created;
  }

  deactivateRule(id: number): boolean {
    const res = this.db
      .prepare(
        "UPDATE reglas_comision SET activo = 0 WHERE id = ? AND activo = 1",
      )
      .run(id);
    return Number(res.changes) > 0;
  }

  listMovements(
    query: ListCommissionsQuery,
    forcedScope?: {
      beneficiaryType: "TRABAJADOR" | "SECRETARIA";
      beneficiaryId: number | null;
    },
  ): {
    movements: CommissionMovementDTO[];
    summaries: CommissionSummaryDTO[];
    totals: {
      trabajadoresNeto: number;
      secretariaNeto: number;
      totalGeneral: number;
    };
  } {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (forcedScope) {
      if (forcedScope.beneficiaryId === null) {
        clauses.push("1 = 0");
      } else {
        clauses.push("mc.beneficiario_tipo = ? AND mc.beneficiario_id = ?");
        params.push(forcedScope.beneficiaryType, forcedScope.beneficiaryId);
      }
    } else {
      if (query.beneficiaryType !== "all") {
        clauses.push("mc.beneficiario_tipo = ?");
        params.push(query.beneficiaryType);
      }
      if (query.workerId) {
        clauses.push(
          "mc.beneficiario_tipo = 'TRABAJADOR' AND mc.beneficiario_id = ?",
        );
        params.push(query.workerId);
      }
    }

    if (query.serviceId) {
      clauses.push("vd.servicio_id = ?");
      params.push(query.serviceId);
    }
    if (query.from) {
      clauses.push("v.fecha_venta >= ?");
      params.push(query.from);
    }
    if (query.to) {
      clauses.push("v.fecha_venta <= ?");
      params.push(query.to);
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
      .all(...params) as unknown as MovementRow[];

    const movements: CommissionMovementDTO[] = rows.map((r) => ({
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

    const summaryMap = new Map<string, CommissionSummaryDTO>();
    for (const m of movements) {
      const key = `${m.beneficiarioTipo}:${m.beneficiarioId}`;
      const existing = summaryMap.get(key) ?? {
        beneficiarioTipo: m.beneficiarioTipo,
        beneficiarioId: m.beneficiarioId,
        beneficiarioNombre: m.beneficiarioNombre,
        devengado: 0,
        ajustes: 0,
        neto: 0,
        operaciones: 0,
      };
      if (m.tipoMovimiento === "DEVENGADA") {
        existing.devengado = Number((existing.devengado + m.monto).toFixed(2));
        existing.operaciones += 1;
      } else {
        existing.ajustes = Number((existing.ajustes + m.monto).toFixed(2));
      }
      existing.neto = Number(
        (existing.devengado + existing.ajustes).toFixed(2),
      );
      summaryMap.set(key, existing);
    }

    const summaries = [...summaryMap.values()];
    const trabajadoresNeto = Number(
      summaries
        .filter((s) => s.beneficiarioTipo === "TRABAJADOR")
        .reduce((acc, s) => acc + s.neto, 0)
        .toFixed(2),
    );
    const secretariaNeto = Number(
      summaries
        .filter((s) => s.beneficiarioTipo === "SECRETARIA")
        .reduce((acc, s) => acc + s.neto, 0)
        .toFixed(2),
    );

    return {
      movements,
      summaries,
      totals: {
        trabajadoresNeto,
        secretariaNeto,
        totalGeneral: Number((trabajadoresNeto + secretariaNeto).toFixed(2)),
      },
    };
  }
}
