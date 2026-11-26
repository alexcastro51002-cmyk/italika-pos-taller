import { useEffect, useState } from "react";
import type { AuthUser } from "../../shared/types.js";
import * as api from "../api.js";
import { formatCurrency } from "../format.js";

export function DashboardPage({
  token,
  user,
}: { token: string; user: AuthUser }) {
  const [salesCount, setSalesCount] = useState<number>(0);
  const [pendingOrders, setPendingOrders] = useState<number>(0);
  const [commNeto, setCommNeto] = useState<number>(0);

  useEffect(() => {
    if (user.permisos.includes("sales:read")) {
      api
        .listSales(token, { status: "VIGENTE" })
        .then((r) => setSalesCount(r.sales.length))
        .catch(() => {});
    }
    if (
      user.permisos.includes("work:read_all") ||
      user.permisos.includes("work:read_own")
    ) {
      api
        .listWorkOrders(token)
        .then((r) =>
          setPendingOrders(
            r.summary.pendientes + r.summary.programados + r.summary.enProceso,
          ),
        )
        .catch(() => {});
    }
    if (
      user.permisos.includes("commissions:read_all") ||
      user.permisos.includes("commissions:read_own")
    ) {
      api
        .listCommissions(token)
        .then((r) => setCommNeto(r.totals.totalGeneral))
        .catch(() => {});
    }
  }, [token, user]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Panel principal</h1>
          <div className="sub">
            Sistema de Venta y Administración de Servicios (E1–E4 completo).
          </div>
        </div>
        <span className="badge blue">Rol: {user.rol}</span>
      </div>
      <div className="grid">
        <div className="card">
          <div className="metric-label">Usuario en sesión</div>
          <div className="metric" style={{ fontSize: 17 }}>
            {user.nombre}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">
            {user.permisos.includes("sales:read")
              ? "Ventas vigentes"
              : "Permisos activos"}
          </div>
          <div className="metric">
            {user.permisos.includes("sales:read")
              ? salesCount
              : user.permisos.length}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">Servicios pendientes / en proceso</div>
          <div className="metric">{pendingOrders}</div>
        </div>
      </div>
      <div className="panel">
        <h2>Resumen de comisiones visibles</h2>
        <p className="sub">
          Saldo neto acumulado según tu rol y permisos:{" "}
          <b>{formatCurrency(commNeto)}</b>
        </p>
      </div>
    </section>
  );
}
