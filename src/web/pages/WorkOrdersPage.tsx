import { useCallback, useEffect, useState } from "react";
import type {
  AuthUser,
  ServiceExecutionStatus,
  WorkOrderDTO,
  WorkOrderSummaryDTO,
  WorkerDTO,
} from "../../shared/types.js";
import * as api from "../api.js";

export function WorkOrdersPage({
  token,
  user,
  onError,
}: {
  token: string;
  user: AuthUser;
  onError: (msg: string) => void;
}) {
  const [orders, setOrders] = useState<WorkOrderDTO[]>([]);
  const [summary, setSummary] = useState<WorkOrderSummaryDTO>({
    total: 0,
    pendientes: 0,
    programados: 0,
    enProceso: 0,
    realizados: 0,
    cancelados: 0,
  });
  const [workers, setWorkers] = useState<WorkerDTO[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const canReadAll = user.permisos.includes("work:read_all");
  const canUpdateAll = user.permisos.includes("work:update");

  const load = useCallback(async () => {
    const res = await api.listWorkOrders(token, { workerId, status, from, to });
    setOrders(res.orders);
    setSummary(res.summary);
  }, [token, workerId, status, from, to]);

  useEffect(() => {
    if (canReadAll) {
      api
        .listWorkers(token)
        .then((r) => setWorkers(r.workers))
        .catch(() => {});
    }
  }, [token, canReadAll]);

  useEffect(() => {
    load().catch((err) =>
      onError(err instanceof Error ? err.message : "Error cargando servicios."),
    );
  }, [load, onError]);

  async function handleStatusChange(
    orderId: number,
    nextStatus: ServiceExecutionStatus,
  ) {
    onError("");
    try {
      await api.updateWorkOrderStatus(token, orderId, nextStatus);
      await load();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo actualizar estado.",
      );
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Servicios realizados y seguimiento</h1>
          <div className="sub">
            M4 (H4.1–H4.4): Estado operativo independiente de la venta y
            confirmación por trabajador.
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="metric-label">Total mostrados</div>
          <div className="metric">{summary.total}</div>
        </div>
        <div className="card">
          <div className="metric-label">Pendientes / En proceso</div>
          <div className="metric">
            {summary.pendientes + summary.programados + summary.enProceso}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">Realizados</div>
          <div className="metric">{summary.realizados}</div>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          {canReadAll ? (
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
          ) : null}
          <select
            aria-label="Estado"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PROGRAMADO">Programado</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="REALIZADO">Realizado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
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
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Servicio</th>
                <th>Cliente</th>
                <th>Trabajador</th>
                <th>Fecha prog.</th>
                <th>Estado</th>
                <th>Actualizar</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.folio}</b>
                  </td>
                  <td>{o.servicioNombre}</td>
                  <td>{o.clienteNombre ?? "Público general"}</td>
                  <td>{o.trabajadorNombre ?? "Sin asignar"}</td>
                  <td>{o.fechaProgramada ?? "—"}</td>
                  <td>
                    <span
                      className={`badge ${o.estadoServicio === "REALIZADO" ? "green" : o.estadoServicio === "CANCELADO" ? "red" : "blue"}`}
                    >
                      {o.estadoServicio}
                    </span>
                  </td>
                  <td>
                    {o.estadoVenta === "CANCELADA" ? (
                      <span className="sub">Venta cancelada</span>
                    ) : canUpdateAll ? (
                      <select
                        aria-label={`Estado de ${o.folio}`}
                        value={o.estadoServicio}
                        onChange={(e) =>
                          handleStatusChange(
                            o.id,
                            e.target.value as ServiceExecutionStatus,
                          )
                        }
                      >
                        <option value="PENDIENTE">PENDIENTE</option>
                        <option value="PROGRAMADO">PROGRAMADO</option>
                        <option value="EN_PROCESO">EN_PROCESO</option>
                        <option value="REALIZADO">REALIZADO</option>
                        <option value="CANCELADO">CANCELADO</option>
                      </select>
                    ) : o.estadoServicio !== "REALIZADO" ? (
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => handleStatusChange(o.id, "REALIZADO")}
                      >
                        Confirmar realizado
                      </button>
                    ) : (
                      <span className="sub">Confirmado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
