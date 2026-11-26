import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { AuthUser, Permission } from "../shared/types.js";
import * as api from "./api.js";
import { CatalogPage } from "./pages/CatalogPage.js";
import { CommissionsPage } from "./pages/CommissionsPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { PaymentsPage } from "./pages/PaymentsPage.js";
import { ReportsPage } from "./pages/ReportsPage.js";
import { SalesPage } from "./pages/SalesPage.js";
import { UsersPage } from "./pages/UsersPage.js";
import { WorkOrdersPage } from "./pages/WorkOrdersPage.js";

type PageId =
  | "dashboard"
  | "catalog"
  | "sales"
  | "payments"
  | "work"
  | "commissions"
  | "reports"
  | "users";

const TOKEN_KEY = "svas_token";

function can(user: AuthUser, ...perms: Permission[]): boolean {
  return perms.some((p) => user.permisos.includes(p));
}

export function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [page, setPage] = useState<PageId>("dashboard");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("admin@svas.local");
  const [password, setPassword] = useState("Admin123!");

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setPage("dashboard");
    setError("");
  }, []);

  useEffect(() => {
    if (!token) return;
    api
      .fetchMe(token)
      .then((res) => setUser(res.user))
      .catch(() => logout());
  }, [token, logout]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.login(email, password);
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
      setPage("dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación.");
    }
  }

  if (!user || !token) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>SVAS · Iniciar sesión</h1>
          <p className="sub">
            Sistema de Venta y Administración de Servicios (Control RBAC).
          </p>
          {error ? <div className="alert error">{error}</div> : null}
          <form onSubmit={handleLogin}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="login-email">Correo electrónico</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              className="btn primary"
              type="submit"
              style={{ width: "100%" }}
            >
              Entrar al sistema
            </button>
          </form>
          <div className="demo-pills">
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setEmail("admin@svas.local");
                setPassword("Admin123!");
              }}
            >
              Demo Admin
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setEmail("secretaria@svas.local");
                setPassword("Secre123!");
              }}
            >
              Demo Secretaria
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setEmail("trabajador@svas.local");
                setPassword("Trab123!");
              }}
            >
              Demo Trabajador
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: PageId; label: string; visible: boolean }> = [
    { id: "dashboard", label: "Panel principal", visible: true },
    {
      id: "catalog",
      label: "Catálogo de servicios",
      visible: can(user, "catalog:read"),
    },
    { id: "sales", label: "Ventas", visible: can(user, "sales:read") },
    {
      id: "payments",
      label: "Pagos y abonos",
      visible: can(user, "payments:read"),
    },
    {
      id: "work",
      label: "Servicios realizados",
      visible: can(user, "work:read_all", "work:read_own"),
    },
    {
      id: "commissions",
      label: "Comisiones",
      visible: can(user, "commissions:read_all", "commissions:read_own"),
    },
    { id: "reports", label: "Reportes", visible: can(user, "reports:read") },
    {
      id: "users",
      label: "Control de accesos",
      visible: can(user, "users:manage"),
    },
  ];

  return (
    <>
      <header className="no-print">
        <div className="brand">
          SVAS <small>Sistema de venta y administración de servicios</small>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>
            {user.nombre} · <b>{user.rol}</b>
          </span>
          <button type="button" className="btn small" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <div className="layout">
        <aside className="no-print">
          <div className="nav-label">MENÚ PRINCIPAL</div>
          <nav>
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={page === item.id ? "active" : ""}
                  onClick={() => {
                    setError("");
                    setPage(item.id);
                  }}
                >
                  {item.label}
                </button>
              ))}
          </nav>
        </aside>
        <main>
          {error ? <div className="alert error no-print">{error}</div> : null}

          {page === "dashboard" ? (
            <DashboardPage token={token} user={user} />
          ) : null}
          {page === "catalog" && can(user, "catalog:read") ? (
            <CatalogPage token={token} user={user} onError={setError} />
          ) : null}
          {page === "sales" && can(user, "sales:read") ? (
            <SalesPage token={token} user={user} onError={setError} />
          ) : null}
          {page === "payments" && can(user, "payments:read") ? (
            <PaymentsPage token={token} user={user} onError={setError} />
          ) : null}
          {page === "work" && can(user, "work:read_all", "work:read_own") ? (
            <WorkOrdersPage token={token} user={user} onError={setError} />
          ) : null}
          {page === "commissions" &&
          can(user, "commissions:read_all", "commissions:read_own") ? (
            <CommissionsPage token={token} user={user} onError={setError} />
          ) : null}
          {page === "reports" && can(user, "reports:read") ? (
            <ReportsPage token={token} onError={setError} />
          ) : null}
          {page === "users" && can(user, "users:manage") ? (
            <UsersPage token={token} onError={setError} />
          ) : null}
        </main>
      </div>
    </>
  );
}
