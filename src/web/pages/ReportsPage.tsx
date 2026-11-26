import { useCallback, useEffect, useState } from "react";
import type {
  CommissionsReportDTO,
  IncomeReportDTO,
  SalesReportDTO,
  ServicesReportDTO,
  WorkerDTO,
} from "../../shared/types.js";
import * as api from "../api.js";
import { formatCurrency } from "../format.js";

type TabType = "sales" | "services" | "income" | "commissions";

export function ReportsPage({
  token,
  onError,
}: {
  token: string;
  onError: (msg: string) => void;
}) {
  const [tab, setTab] = useState<TabType>("sales");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workers, setWorkers] = useState<WorkerDTO[]>([]);

  const [salesRep, setSalesRep] = useState<SalesReportDTO | null>(null);
  const [servicesRep, setServicesRep] = useState<ServicesReportDTO | null>(
    null,
  );
  const [incomeRep, setIncomeRep] = useState<IncomeReportDTO | null>(null);
  const [commRep, setCommRep] = useState<CommissionsReportDTO | null>(null);

  useEffect(() => {
    api
      .listWorkers(token)
      .then((r) => setWorkers(r.workers))
      .catch(() => {});
  }, [token]);

  const load = useCallback(async () => {
    const filters = { groupBy, from, to, workerId };
    if (tab === "sales") {
      setSalesRep((await api.getSalesReport(token, filters)).report);
    } else if (tab === "services") {
      setServicesRep((await api.getServicesReport(token, filters)).report);
    } else if (tab === "income") {
      setIncomeRep((await api.getIncomeReport(token, filters)).report);
    } else {
      setCommRep((await api.getCommissionsReport(token, filters)).report);
    }
  }, [token, tab, groupBy, from, to, workerId]);

  useEffect(() => {
    load().catch((err) =>
      onError(err instanceof Error ? err.message : "Error cargando reporte."),
    );
  }, [load, onError]);

  return (
    <section className="print-area">
      <div className="page-head">
        <div>
          <h1>Reportes gerenciales y exportación</h1>
          <div className="sub">
            M7 (H7.1–H7.5): Ventas, servicios, ingresos reales y comisiones
            separadas.
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              api
                .downloadReportCsv(token, tab, { groupBy, from, to, workerId })
                .catch((err) =>
                  onError(
                    err instanceof Error ? err.message : "Error al exportar.",
                  ),
                )
            }
          >
            Exportar CSV
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>

      <div className="panel no-print">
        <div className="toolbar">
          <button
            type="button"
            className={`btn ${tab === "sales" ? "primary" : ""}`}
            onClick={() => setTab("sales")}
          >
            Ventas (H7.1)
          </button>
          <button
            type="button"
            className={`btn ${tab === "services" ? "primary" : ""}`}
            onClick={() => setTab("services")}
          >
            Servicios (H7.2)
          </button>
          <button
            type="button"
            className={`btn ${tab === "income" ? "primary" : ""}`}
            onClick={() => setTab("income")}
          >
            Ingresos (H7.3)
          </button>
          <button
            type="button"
            className={`btn ${tab === "commissions" ? "primary" : ""}`}
            onClick={() => setTab("commissions")}
          >
            Comisiones (H7.4)
          </button>
        </div>
        <div className="toolbar">
          {tab === "sales" ? (
            <select
              aria-label="Agrupar por"
              value={groupBy}
              onChange={(e) =>
                setGroupBy(e.target.value as "day" | "week" | "month")
              }
            >
              <option value="day">Por día</option>
              <option value="week">Por semana</option>
              <option value="month">Por mes</option>
            </select>
          ) : null}
          <input
            type="date"
            aria-label="Desde"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            aria-label="Hasta"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <select
            aria-label="Trabajador"
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
          >
            <option value="">Todos los trabajadores</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === "sales" && salesRep ? (
        <div className="panel">
          <h2>Reporte de ventas</h2>
          <p className="sub">
            Vigentes: <b>{salesRep.totales.ventasVigentes}</b> · Canceladas:{" "}
            <b>{salesRep.totales.ventasCanceladas}</b> · Total vendido:{" "}
            <b>{formatCurrency(salesRep.totales.totalVendido)}</b>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th>Descuentos</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {salesRep.periodos.map((p) => (
                  <tr key={p.periodo}>
                    <td>{p.periodo}</td>
                    <td>{p.cantidad}</td>
                    <td>{formatCurrency(p.subtotal)}</td>
                    <td>{formatCurrency(p.descuentos)}</td>
                    <td>{formatCurrency(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "services" && servicesRep ? (
        <div className="panel">
          <h2>
            Servicios concluidos por trabajador ({servicesRep.totalRealizados})
          </h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>Servicios realizados</th>
                  <th>Importe acumulado</th>
                </tr>
              </thead>
              <tbody>
                {servicesRep.porTrabajador.map((w) => (
                  <tr key={w.trabajadorNombre}>
                    <td>{w.trabajadorNombre}</td>
                    <td>{w.cantidad}</td>
                    <td>{formatCurrency(w.importeServicios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "income" && incomeRep ? (
        <div className="panel">
          <h2>Reporte de ingresos reales</h2>
          <p className="sub">
            Total vendido vigente:{" "}
            <b>{formatCurrency(incomeRep.totales.totalVendidoVigente)}</b> ·
            Cobrado neto:{" "}
            <b>{formatCurrency(incomeRep.totales.totalCobradoNeto)}</b> · Saldo
            pendiente:{" "}
            <b>{formatCurrency(incomeRep.totales.saldoPendienteTotal)}</b>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Método</th>
                  <th>Cobrado</th>
                  <th>Reembolsado</th>
                  <th>Neto</th>
                  <th>Movimientos</th>
                </tr>
              </thead>
              <tbody>
                {incomeRep.porMetodo.map((m) => (
                  <tr key={m.metodoPago}>
                    <td>{m.metodoPago}</td>
                    <td>{formatCurrency(m.cobrado)}</td>
                    <td>{formatCurrency(m.reembolsado)}</td>
                    <td>{formatCurrency(m.neto)}</td>
                    <td>{m.movimientos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "commissions" && commRep ? (
        <div className="panel">
          <h2>Comisiones separadas (Trabajadores vs. Secretaria)</h2>
          <p className="sub">
            Trabajadores:{" "}
            <b>{formatCurrency(commRep.totales.trabajadoresNeto)}</b> ·
            Secretaria: <b>{formatCurrency(commRep.totales.secretariaNeto)}</b>{" "}
            · Total: <b>{formatCurrency(commRep.totales.totalGeneral)}</b>
          </p>
          <h3>Trabajadores</h3>
          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>Operaciones</th>
                  <th>Devengado</th>
                  <th>Ajustes</th>
                  <th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {commRep.trabajadores.map((t) => (
                  <tr key={t.beneficiarioId}>
                    <td>{t.beneficiarioNombre}</td>
                    <td>{t.operaciones}</td>
                    <td>{formatCurrency(t.devengado)}</td>
                    <td>{formatCurrency(t.ajustes)}</td>
                    <td>{formatCurrency(t.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Secretaria</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Secretaria</th>
                  <th>Operaciones</th>
                  <th>Devengado</th>
                  <th>Ajustes</th>
                  <th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {commRep.secretaria.map((s) => (
                  <tr key={s.beneficiarioId}>
                    <td>{s.beneficiarioNombre}</td>
                    <td>{s.operaciones}</td>
                    <td>{formatCurrency(s.devengado)}</td>
                    <td>{formatCurrency(s.ajustes)}</td>
                    <td>{formatCurrency(s.neto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
