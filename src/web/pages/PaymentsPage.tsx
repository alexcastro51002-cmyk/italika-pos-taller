import { type FormEvent, useCallback, useEffect, useState } from "react";
import type {
  AuthUser,
  PaymentAccountSummaryDTO,
  PaymentDTO,
  PaymentMethod,
  ReceiptDTO,
} from "../../shared/types.js";
import * as api from "../api.js";
import { formatCurrency, todayIso } from "../format.js";

export function PaymentsPage({
  token,
  user,
  onError,
}: {
  token: string;
  user: AuthUser;
  onError: (msg: string) => void;
}) {
  const [summaries, setSummaries] = useState<PaymentAccountSummaryDTO[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("EFECTIVO");
  const [payDate, setPayDate] = useState(todayIso());
  const [receipt, setReceipt] = useState<ReceiptDTO | null>(null);
  const [history, setHistory] = useState<{
    folio: string;
    payments: PaymentDTO[];
  } | null>(null);

  const canCreate = user.permisos.includes("payments:create");
  const canHistory = user.permisos.includes("payments:history");

  const load = useCallback(async () => {
    const res = await api.listPaymentSummaries(token);
    setSummaries(res.summaries);
    const pending = res.summaries.find(
      (s) => s.estadoVenta === "VIGENTE" && s.saldoPendiente > 0,
    );
    if (pending && !selectedSaleId) {
      setSelectedSaleId(String(pending.ventaId));
    }
  }, [token, selectedSaleId]);

  useEffect(() => {
    load().catch((err) =>
      onError(err instanceof Error ? err.message : "Error cargando pagos."),
    );
  }, [load, onError]);

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (!selectedSaleId) return;
    onError("");
    try {
      await api.registerPayment(token, Number(selectedSaleId), {
        monto: Number(amount),
        metodoPago: method,
        fechaPago: payDate,
      });
      setAmount("");
      setSelectedSaleId("");
      await load();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo registrar pago.",
      );
    }
  }

  async function handleOpenReceipt(ventaId: number) {
    onError("");
    try {
      const res = await api.getReceipt(token, ventaId);
      setReceipt(res.receipt);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Error generando comprobante.",
      );
    }
  }

  async function handleOpenHistory(ventaId: number, folio: string) {
    onError("");
    try {
      const res = await api.listSalePayments(token, ventaId);
      setHistory({ folio, payments: res.payments });
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Error consultando historial.",
      );
    }
  }

  const payableSales = summaries.filter(
    (s) => s.estadoVenta === "VIGENTE" && s.saldoPendiente > 0,
  );

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Pagos, abonos y comprobantes</h1>
          <div className="sub">
            M3 (H3.1–H3.5): Pagos parciales, saldo pendiente, comprobante
            imprimible e historial.
          </div>
        </div>
      </div>

      {canCreate ? (
        <div className="panel no-print">
          <h2>Registrar pago o abono</h2>
          <form onSubmit={handlePay}>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="p-sale">Venta vigente con saldo</label>
                <select
                  id="p-sale"
                  required
                  value={selectedSaleId}
                  onChange={(e) => setSelectedSaleId(e.target.value)}
                >
                  <option value="">-- Selecciona una venta --</option>
                  {payableSales.map((s) => (
                    <option key={s.ventaId} value={s.ventaId}>
                      {s.folio} · {s.clienteNombre ?? "Público general"} · Saldo{" "}
                      {formatCurrency(s.saldoPendiente)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-amount">Importe recibido (MXN)</label>
                <input
                  id="p-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="p-method">Método de pago</label>
                <select
                  id="p-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-date">Fecha de pago</label>
                <input
                  id="p-date"
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="submit"
                className="btn primary"
                disabled={payableSales.length === 0}
              >
                Guardar pago
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {receipt ? (
        <div className="panel print-area">
          <div className="page-head">
            <div>
              <h2>Comprobante de venta y pago · {receipt.folio}</h2>
              <div className="sub">
                Fecha: {receipt.fechaVenta} · Cliente: {receipt.clienteNombre} ·
                Atendió: {receipt.registradoPorNombre}
              </div>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn primary small"
                onClick={() => window.print()}
              >
                Imprimir comprobante
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => setReceipt(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
          <p>
            <b>Subtotal:</b> {formatCurrency(receipt.subtotal)} ·{" "}
            <b>Descuento:</b> {formatCurrency(receipt.descuentoAutorizado)} ·{" "}
            <b>Total:</b> {formatCurrency(receipt.total)} · <b>Pagado:</b>{" "}
            {formatCurrency(receipt.pagado)} · <b>Saldo pendiente:</b>{" "}
            {formatCurrency(receipt.saldoPendiente)} ({receipt.estadoPago})
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Trabajador</th>
                  <th>Precio</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {receipt.servicios.map((sv, i) => (
                  <tr key={`${sv.servicioNombre}-${i}`}>
                    <td>{sv.servicioNombre}</td>
                    <td>{sv.trabajadorNombre ?? "Sin asignar"}</td>
                    <td>{formatCurrency(sv.precioAplicado)}</td>
                    <td>{sv.estadoServicio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {history ? (
        <div className="panel no-print">
          <div className="page-head">
            <h2>Historial de pagos · {history.folio}</h2>
            <button
              type="button"
              className="btn small"
              onClick={() => setHistory(null)}
            >
              Cerrar
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Método</th>
                  <th>Importe</th>
                  <th>Registró</th>
                </tr>
              </thead>
              <tbody>
                {history.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.fechaPago}</td>
                    <td>{p.tipo}</td>
                    <td>{p.metodoPago}</td>
                    <td>{formatCurrency(p.monto)}</td>
                    <td>{p.registradoPorNombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel no-print">
        <h2>Estado de cuenta por venta</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Saldo pendiente</th>
                <th>Estado pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.ventaId}>
                  <td>
                    <b>{s.folio}</b>{" "}
                    {s.estadoVenta === "CANCELADA" ? (
                      <span className="badge red">CANCELADA</span>
                    ) : null}
                  </td>
                  <td>{s.clienteNombre ?? "Público general"}</td>
                  <td>{formatCurrency(s.total)}</td>
                  <td>{formatCurrency(s.pagado)}</td>
                  <td>{formatCurrency(s.saldoPendiente)}</td>
                  <td>
                    <span
                      className={`badge ${s.estadoPago === "LIQUIDADA" ? "green" : s.estadoPago === "PARCIALMENTE_PAGADA" ? "orange" : "red"}`}
                    >
                      {s.estadoPago}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => handleOpenReceipt(s.ventaId)}
                      >
                        Comprobante
                      </button>
                      {canHistory ? (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => handleOpenHistory(s.ventaId, s.folio)}
                        >
                          Historial
                        </button>
                      ) : null}
                    </div>
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
