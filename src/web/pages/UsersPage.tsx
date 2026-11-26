import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { Role, UserDTO } from "../../shared/types.js";
import * as api from "../api.js";

export function UsersPage({
  token,
  onError,
}: {
  token: string;
  onError: (msg: string) => void;
}) {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("SECRETARIA");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    const res = await api.listUsers(token);
    setUsers(res.users);
  }, [token]);

  useEffect(() => {
    load().catch((err) =>
      onError(err instanceof Error ? err.message : "Error cargando usuarios."),
    );
  }, [load, onError]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    onError("");
    try {
      await api.createUser(token, {
        nombre: name,
        email,
        password,
        rol: role,
        telefono: phone,
      });
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo crear usuario.");
    }
  }

  async function handleToggle(u: UserDTO) {
    onError("");
    try {
      await api.updateUserPermissions(token, u.id, { activo: !u.activo });
      await load();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Error actualizando usuario.",
      );
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Control de accesos (H7.6)</h1>
          <div className="sub">
            Administración de usuarios, roles y permisos.
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Registrar usuario</h2>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="u-name">Nombre completo</label>
              <input
                id="u-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="u-email">Correo electrónico</label>
              <input
                id="u-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="u-pass">Contraseña inicial</label>
              <input
                id="u-pass"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="u-role">Rol</label>
              <select
                id="u-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="ADMIN">Administrador</option>
                <option value="SECRETARIA">Secretaria</option>
                <option value="TRABAJADOR">Trabajador</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="u-phone">Teléfono (opcional)</label>
              <input
                id="u-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit" className="btn primary">
              Crear usuario
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Usuarios registrados</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Permisos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.nombre}</b>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge blue">{u.rol}</span>
                  </td>
                  <td>{u.permisosEfectivos.length} activos</td>
                  <td>
                    <span className={`badge ${u.activo ? "green" : "red"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handleToggle(u)}
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
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
