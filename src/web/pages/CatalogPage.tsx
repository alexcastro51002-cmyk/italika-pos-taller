import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { AuthUser, ServiceDTO } from "../../shared/types.js";
import * as api from "../api.js";
import { formatCurrency } from "../format.js";

export function CatalogPage({
  token,
  user,
  onError,
}: {
  token: string;
  user: AuthUser;
  onError: (msg: string) => void;
}) {
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "true" | "false">("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("45");

  const canWrite =
    user.permisos.includes("catalog:write") &&
    user.permisos.includes("catalog:price");

  const load = useCallback(async () => {
    const res = await api.listServices(token, search, filter);
    setServices(res.services);
  }, [token, search, filter]);

  useEffect(() => {
    load().catch((err) =>
      onError(err instanceof Error ? err.message : "Error cargando catálogo."),
    );
  }, [load, onError]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDesc("");
    setPrice("");
    setDuration("45");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    onError("");
    try {
      const payload = {
        nombre: name,
        descripcion: desc,
        precioBase: Number(price),
        duracionMin: Number(duration),
      };
      if (editingId !== null) {
        await api.updateService(token, editingId, payload);
      } else {
        await api.createService(token, payload);
      }
      resetForm();
      await load();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo guardar servicio.",
      );
    }
  }

  async function handleToggle(svc: ServiceDTO) {
    onError("");
    try {
      await api.setServiceStatus(token, svc.id, !svc.activo);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error cambiando estado.");
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Catálogo de servicios</h1>
          <div className="sub">
            M1 (H1.1–H1.5): Servicios, tarifas vigentes y estado.
          </div>
        </div>
      </div>

      {canWrite ? (
        <div className="panel">
          <h2>
            {editingId !== null ? "Modificar servicio" : "Registrar servicio"}
          </h2>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="svc-name">Nombre del servicio</label>
                <input
                  id="svc-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="svc-price">Precio base (MXN)</label>
                <input
                  id="svc-price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="svc-dur">Duración estimada (min)</label>
                <input
                  id="svc-dur"
                  type="number"
                  min="1"
                  required
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className="field full">
                <label htmlFor="svc-desc">Descripción</label>
                <textarea
                  id="svc-desc"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button type="submit" className="btn primary">
                {editingId !== null
                  ? "Actualizar servicio"
                  : "Guardar servicio"}
              </button>
              {editingId !== null ? (
                <button type="button" className="btn" onClick={resetForm}>
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <div className="toolbar">
          <input
            placeholder="Buscar servicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filtrar estado"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "true" | "false")
            }
          >
            <option value="all">Todos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Descripción</th>
                <th>Precio</th>
                <th>Duración</th>
                <th>Estado</th>
                {canWrite ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id}>
                  <td>
                    <b>{svc.nombre}</b>
                  </td>
                  <td>{svc.descripcion || "—"}</td>
                  <td>{formatCurrency(svc.precioBase)}</td>
                  <td>{svc.duracionMin} min</td>
                  <td>
                    <span className={`badge ${svc.activo ? "green" : "red"}`}>
                      {svc.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {canWrite ? (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => {
                            setEditingId(svc.id);
                            setName(svc.nombre);
                            setDesc(svc.descripcion);
                            setPrice(String(svc.precioBase));
                            setDuration(String(svc.duracionMin));
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => handleToggle(svc)}
                        >
                          {svc.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
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
