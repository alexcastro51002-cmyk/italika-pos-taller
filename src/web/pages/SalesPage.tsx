import { type FormEvent, useCallback, useEffect, useState } from "react";
import type {
  AuthUser,
  ClientDTO,
  SaleDTO,
  ServiceDTO,
  WorkerDTO,
} from "../../shared/types.js";
import * as api from "../api.js";
import { formatCurrency, todayIso } from "../format.js";

interface DraftItem {
  key: number;
  servicioId: number;
  trabajadorId: string;
  fechaProgramada: string;
}

export function SalesPage({
  token,
  user,
  onError,
}: {
  token: string;
  user: AuthUser;
  onError: (msg: string) => void;
}) {
  const [sales, setSales] = useState<SaleDTO[]>([]);
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [workers, setWorkers] = useState<WorkerDTO[]>([]);
  const [clients, setClients] = useState<ClientDTO[]>([]);

  // Filtros
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [workerFilter, setWorkerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Nueva venta
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [saleDate, setSaleDate] = useState(todayIso());
  const [discount, setDiscount] = useState("0");
  const [items, setItems] = useState<DraftItem[]>([]);

  // Cancelación
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const canCreate = user.permisos.includes("sales:create");
  const canCancel = user.permisos.includes("sales:cancel");

  const loadSales = useCallback(async () => {
    const res = await api.listSales(token, {
      q,
      from,
      to,
      workerId: workerFilter,
      status: statusFilter,
    });
    setSales(res.sales);
  }, [token, q, from, to, workerFilter, statusFilter]);

  useEffect(() => {
    Promise.all([
      api.listServices(token, "", "true"),
      api.listWorkers(token),
      api.listClients(token),
    ])
      .then(([svcs, wrks, clis]) => {
        setServices(svcs.services);
        setWorkers(wrks.workers);
        setClients(clis.clients);
        const firstSvc = svcs.services[0];
        if (firstSvc && items.length === 0) {
          setItems([
            {
              key: Date.now(),
              servicioId: firstSvc.id,
              trabajadorId: wrks.workers[0] ? String(wrks.workers[0].id) : "",
              fechaProgramada: todayIso(),
            },
          ]);
        }
      })
      .catch((err) =>
        onError(
          err instanceof Error ? err.message : "Error cargando catálogos.",
        ),
      );
  }, [token, onError, items.length]);

  useEffect(() => {
    loadSales().catch((err) =>
      onError(err instanceof Error ? err.message : "Error cargando ventas."),
    );
  }, [loadSales, onError]);

  const subtotal = items.reduce((acc, it) => {
    const svc = services.find((s) => s.id === it.servicioId);
    return acc + (svc ? svc.precioBase : 0);
  }, 0);
  const parsedDiscount = Math.max(0, Number(discount) || 0);
  const calculatedTotal = Math.max(0, subtotal - parsedDiscount);

  function addItem() {
    const firstSvc = services[0];
    if (!firstSvc) return;
    setItems((prev) => [
      ...prev,
      {
        key: Date.now() + prev.length,
        servicioId: firstSvc.id,
        trabajadorId: workers[0] ? String(workers[0].id) : "",
        fechaProgramada: todayIso(),
      },
    ]);
  }

  async function handleCreateSale(e: FormEvent) {
    e.preventDefault();
    onError("");
    try {
      await api.createSale(token, {
        clienteId: clientId ? Number(clientId) : null,
        clienteNombre: clientId ? "" : clientName,
        clienteTelefono: clientId ? "" : clientPhone,
        fechaVenta: saleDate,
        descuentoAutorizado: parsedDiscount,
        items: items.map((it) => ({
          servicioId: it.servicioId,
          trabajadorId: it.trabajadorId ? Number(it.trabajadorId) : null,
          fechaProgramada: it.fechaProgramada || null,
        })),
      });
      setClientId("");
      setClientName("");
      setClientPhone("");
      setDiscount("0");
      await Promise.all([
        loadSales(),
        api.listClients(token).then((c) => setClients(c.clients)),
      ]);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo registrar la venta.",
      );
    }
  }

  async function handleCancelSale(e: FormEvent) {
    e.preventDefault();
    if (cancellingId === null) return;
    onError("");
    try {
      await api.cancelSale(token, cancellingId, cancelReason);
      setCancellingId(null);
      setCancelReason("");
      await loadSales();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo cancelar la venta.",
      );
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Ventas de servicios</h1>
          <div className="sub">
            M2 (H2.1–H2.7): Venta multi-servicio, precios congelados, filtros y
            cancelación con motivo.
          </div>
        </div>
      </div>

      {canCreate ? (
        <div className="panel">
          <h2>Registrar nueva venta</h2>
          <form onSubmit={handleCreateSale}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="s-client">Cliente registrado (opcional)</label>
                <select
                  id="s-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">-- Nuevo o público general --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.telefono ? `(${c.telefono})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-date">Fecha de venta</label>
                <input
                  id="s-date"
                  type="date"
                  required
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                />
              </div>
              {!clientId ? (
                <>
                  <div className="field">
                    <label htmlFor="s-cname">Nombre cliente (si aplica)</label>
                    <input
                      id="s-cname"
                      placeholder="Opcional"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="s-cphone">
                      Teléfono cliente (opcional)
                    </label>
                    <input
                      id="s-cphone"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>

            <h3 style={{ marginTop: 14, marginBottom: 8 }}>
              Servicios incluidos ({items.length})
            </h3>
            {items.map((it, idx) => (
              <div
                key={it.key}
                className="form-grid"
                style={{
                  padding: 10,
                  background: "#f8fafc",
                  borderRadius: 6,
                  marginBottom: 8,
                  gridTemplateColumns: "2fr 1.5fr 1.2fr auto",
                }}
              >
                <div className="field">
                  <label htmlFor={`svc-${it.key}`}>Servicio #{idx + 1}</label>
                  <select
                    id={`svc-${it.key}`}
                    value={it.servicioId}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setItems((prev) =>
                        prev.map((x) =>
                          x.key === it.key ? { ...x, servicioId: val } : x,
                        ),
                      );
                    }}
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} — {formatCurrency(s.precioBase)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`wrk-${it.key}`}>Trabajador asignado</label>
                  <select
                    id={`wrk-${it.key}`}
                    value={it.trabajadorId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((x) =>
                          x.key === it.key ? { ...x, trabajadorId: val } : x,
                        ),
                      );
                    }}
                  >
                    <option value="">Sin asignar</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`fprog-${it.key}`}>Fecha programada</label>
                  <input
                    id={`fprog-${it.key}`}
                    type="date"
                    value={it.fechaProgramada}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((x) =>
                          x.key === it.key ? { ...x, fechaProgramada: val } : x,
                        ),
                      );
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "end" }}>
                  {items.length > 1 ? (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() =>
                        setItems((prev) => prev.filter((x) => x.key !== it.key))
                      }
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}

            <div className="toolbar" style={{ marginTop: 8 }}>
              <button type="button" className="btn small" onClick={addItem}>
                + Agregar otro servicio
              </button>
              <div className="field" style={{ width: 190 }}>
                <label htmlFor="s-disc">Descuento autorizado (MXN)</label>
                <input
                  id="s-disc"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div className="sub">Subtotal: {formatCurrency(subtotal)}</div>
                <div
                  style={{ fontSize: 18, fontWeight: 700, color: "#17365d" }}
                >
                  Total calculado: {formatCurrency(calculatedTotal)}
                </div>
              </div>
            </div>
            <button type="submit" className="btn primary">
              Registrar venta
            </button>
          </form>
        </div>
      ) : null}

      {cancellingId !== null ? (
        <div className="panel" style={{ borderColor: "#eabcbc" }}>
          <h2>Cancelar venta #{cancellingId}</h2>
          <form onSubmit={handleCancelSale} className="toolbar">
            <input
              required
              minLength={3}
              style={{ flex: 1, minWidth: 260 }}
              placeholder="Motivo obligatorio de cancelación..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <button type="submit" className="btn primary">
              Confirmar cancelación
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCancellingId(null);
                setCancelReason("");
              }}
            >
              Cerrar
            </button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <h2>Historial de ventas</h2>
        <div className="toolbar">
          <input
            placeholder="Buscar folio, cliente, servicio o trabajador"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
          >
            <option value="">Todos los trabajadores</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Estado comercial"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="VIGENTE">Vigentes</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Servicios</th>
                <th>Total</th>
                <th>Cobrado</th>
                <th>Estado venta</th>
                <th>Estado pago</th>
                {canCancel ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.folio}</b>
                  </td>
                  <td>{s.fechaVenta}</td>
                  <td>{s.clienteNombre ?? "Público general"}</td>
                  <td>
                    {s.detalles
                      .map(
                        (d) =>
                          `${d.servicioNombre}${d.trabajadorNombre ? ` (${d.trabajadorNombre})` : ""}`,
                      )
                      .join(", ")}
                  </td>
                  <td>{formatCurrency(s.total)}</td>
                  <td>{formatCurrency(s.pagado)}</td>
                  <td>
                    <span
                      className={`badge ${s.estadoVenta === "VIGENTE" ? "blue" : "red"}`}
                    >
                      {s.estadoVenta}
                    </span>
                    {s.motivoCancelacion ? (
                      <div className="sub">{s.motivoCancelacion}</div>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={`badge ${s.estadoPago === "LIQUIDADA" ? "green" : s.estadoPago === "PARCIALMENTE_PAGADA" ? "orange" : "red"}`}
                    >
                      {s.estadoPago}
                    </span>
                  </td>
                  {canCancel ? (
                    <td>
                      {s.estadoVenta === "VIGENTE" ? (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => setCancellingId(s.id)}
                        >
                          Cancelar
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
