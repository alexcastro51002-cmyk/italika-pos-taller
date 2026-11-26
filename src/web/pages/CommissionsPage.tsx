import { type FormEvent, useCallback, useEffect, useState } from "react";
import type {
  AuthUser,
  CommissionBase,
  CommissionConfigDTO,
  CommissionMovementDTO,
  CommissionRuleDTO,
  CommissionSummaryDTO,
  CommissionTrigger,
  ServiceDTO,
  WorkerDTO,
} from "../../shared/types.js";
import * as api from "../api.js";
import { formatCurrency } from "../format.js";

export function CommissionsPage({
  token,
  user,
  onError,
}: {
  token: string;
  user: AuthUser;
  onError: (msg: string) => void;
}) {
  const [config, setConfig] = useState<CommissionConfigDTO | null>(null);
  const [rules, setRules] = useState<CommissionRuleDTO[]>([]);
  const [workers, setWorkers] = useState<WorkerDTO[]>([]);
  const [services, setServices] = useState<ServiceDTO[]>([]);

  const [movements, setMovements] = useState<CommissionMovementDTO[]>([]);
  const [summaries, setSummaries] = useState<CommissionSummaryDTO[]>([]);
  const [totals, setTotals] = useState({
    trabajadoresNeto: 0,
    secretariaNeto: 0,
    totalGeneral: 0,
  });

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ruleWorkerId, setRuleWorkerId] = useState("");
  const [ruleServiceId, setRuleServiceId] = useState("");
  const [ruleRate, setRuleRate] = useState("15");

  const canConfig = user.permisos.includes("commissions:config");

  const loadList = useCallback(async () => {
    const res = await api.listCommissions(token, { from, to });
    setMovements(res.movements);
    setSummaries(res.summaries);
    setTotals(res.totals);
  }, [token, from, to]);

  const loadConfig = useCallback(async () => {
    if (!canConfig) return;
    const [cfg, wrks, svcs] = await Promise.all([
      api.getCommissionConfig(token),
      api.listWorkers(token),
      api.listServices(token, "", "all"),
    ]);
    setConfig(cfg.config);
    setRules(cfg.rules);
    setWorkers(wrks.workers);
    setServices(svcs.services);
  }, [token, canConfig]);

  useEffect(() => {
    loadConfig().catch((err) =>
      onError(err instanceof Error ? err.message : "Error cargando reglas."),
    );
  }, [loadConfig, onError]);

  useEffect(() => {
    loadList().catch((err) =>
      onError(
        err instanceof Error ? err.message : "Error cargando comisiones.",
      ),
    );
  }, [loadList, onError]);

  async function handleSaveConfig(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    onError("");
    try {
      const res = await api.updateCommissionConfig(token, config);
      setConfig(res.config);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo guardar config.",
      );
    }
  }

  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();
    onError("");
    try {
      await api.createCommissionRule(token, {
        trabajadorId: ruleWorkerId ? Number(ruleWorkerId) : null,
        servicioId: ruleServiceId ? Number(ruleServiceId) : null,
        porcentaje: Number(ruleRate),
      });
      await loadConfig();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo crear regla.");
    }
  }

  async function handleDeleteRule(id: number) {
    onError("");
    try {
      await api.deleteCommissionRule(token, id);
      await loadConfig();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo eliminar regla.",
      );
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Comisiones</h1>
          <div className="sub">
            M5/M6 (H5.1–H6.5): Motor configurable e historial inmutable por
            beneficiario.
          </div>
        </div>
      </div>

      {canConfig && config ? (
        <div className="panel">
          <h2>Configuración de reglas (solo aplica a operaciones futuras)</h2>
          <form onSubmit={handleSaveConfig}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="c-ttrab">Tasa global trabajador (%)</label>
                <input
                  id="c-ttrab"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={config.tasaTrabajadorGlobal}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      tasaTrabajadorGlobal: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="c-tsec">Tasa global secretaria (%)</label>
                <input
                  id="c-tsec"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={config.tasaSecretariaGlobal}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      tasaSecretariaGlobal: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="c-dtrab">Disparador trabajador</label>
                <select
                  id="c-dtrab"
                  value={config.disparadorTrabajador}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      disparadorTrabajador: e.target.value as CommissionTrigger,
                    })
                  }
                >
                  <option value="AL_VENDER">Al vender</option>
                  <option value="AL_REALIZAR">Al realizar servicio</option>
                  <option value="AL_LIQUIDAR">Al liquidar venta</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-dsec">Disparador secretaria</label>
                <select
                  id="c-dsec"
                  value={config.disparadorSecretaria}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      disparadorSecretaria: e.target.value as CommissionTrigger,
                    })
                  }
                >
                  <option value="AL_VENDER">Al vender</option>
                  <option value="AL_REALIZAR">Al realizar servicio</option>
                  <option value="AL_LIQUIDAR">Al liquidar venta</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-base">Base elegible</label>
                <select
                  id="c-base"
                  value={config.baseElegible}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      baseElegible: e.target.value as CommissionBase,
                    })
                  }
                >
                  <option value="BRUTO">Bruto (sin descontar)</option>
                  <option value="NETO_POST_DESCUENTO">
                    Neto después de descuentos
                  </option>
                  <option value="COBRADO_REAL">Cobrado real</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-sec-own">Alcance secretaria</label>
                <select
                  id="c-sec-own"
                  value={config.secSoloVentasPropias ? "true" : "false"}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      secSoloVentasPropias: e.target.value === "true",
                    })
                  }
                >
                  <option value="true">
                    Solo ventas registradas por Secretaria
                  </option>
                  <option value="false">Todas las ventas vigentes</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="submit" className="btn primary">
                Guardar configuración
              </button>
            </div>
          </form>

          <h3 style={{ marginTop: 18 }}>
            Reglas específicas por trabajador / servicio
          </h3>
          <form onSubmit={handleCreateRule} className="toolbar">
            <select
              aria-label="Trabajador regla"
              value={ruleWorkerId}
              onChange={(e) => setRuleWorkerId(e.target.value)}
            >
              <option value="">Cualquier trabajador</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nombre}
                </option>
              ))}
            </select>
            <select
              aria-label="Servicio regla"
              value={ruleServiceId}
              onChange={(e) => setRuleServiceId(e.target.value)}
            >
              <option value="">Cualquier servicio</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              style={{ width: 100 }}
              value={ruleRate}
              onChange={(e) => setRuleRate(e.target.value)}
            />
            <button type="submit" className="btn primary small">
              Agregar regla
            </button>
          </form>
          {rules.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Trabajador</th>
                    <th>Servicio</th>
                    <th>Porcentaje</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td>{r.trabajadorNombre ?? "Todos"}</td>
                      <td>{r.servicioNombre ?? "Todos"}</td>
                      <td>{r.porcentaje}%</td>
                      <td>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => handleDeleteRule(r.id)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid">
        <div className="card">
          <div className="metric-label">Neto trabajadores</div>
          <div className="metric">
            {formatCurrency(totals.trabajadoresNeto)}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">Neto secretaria</div>
          <div className="metric">{formatCurrency(totals.secretariaNeto)}</div>
        </div>
        <div className="card">
          <div className="metric-label">Total general</div>
          <div className="metric">{formatCurrency(totals.totalGeneral)}</div>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
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
        <h2>Acumulado por beneficiario</h2>
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Beneficiario</th>
                <th>Operaciones</th>
                <th>Devengado</th>
                <th>Ajustes</th>
                <th>Neto</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={`${s.beneficiarioTipo}-${s.beneficiarioId}`}>
                  <td>{s.beneficiarioTipo}</td>
                  <td>
                    <b>{s.beneficiarioNombre}</b>
                  </td>
                  <td>{s.operaciones}</td>
                  <td>{formatCurrency(s.devengado)}</td>
                  <td>{formatCurrency(s.ajustes)}</td>
                  <td>
                    <b>{formatCurrency(s.neto)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Libro mayor de movimientos (Ledger inmutable)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Tipo</th>
                <th>Beneficiario</th>
                <th>Servicio</th>
                <th>Base</th>
                <th>%</th>
                <th>Movimiento</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.folio}</td>
                  <td>{m.beneficiarioTipo}</td>
                  <td>{m.beneficiarioNombre}</td>
                  <td>{m.servicioNombre ?? "Venta completa"}</td>
                  <td>{formatCurrency(m.baseElegible)}</td>
                  <td>{m.porcentajeAplicado}%</td>
                  <td>
                    <span
                      className={`badge ${m.tipoMovimiento === "DEVENGADA" ? "green" : "red"}`}
                    >
                      {m.tipoMovimiento}
                    </span>
                  </td>
                  <td>{formatCurrency(m.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
