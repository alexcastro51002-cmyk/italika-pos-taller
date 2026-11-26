# SVAS — Sistema de Venta y Administración de Servicios

[![SVAS Gatekeeper CI](https://github.com/alexcastro51002-cmyk/italika-pos-taller/actions/workflows/check.yml/badge.svg)](https://github.com/alexcastro51002-cmyk/italika-pos-taller/actions/workflows/check.yml)

Sistema full-stack para la gestión comercial, operativa y de comisiones en negocios de servicios, construido bajo arquitectura **Monolito Modular en Vertical Slices** y prácticas de **Agent-First Engineering** (Calidad de Software y Metodologías Ágiles).

Cubre las **37 historias de usuario (`H1.1`–`H7.6`)**, las **10 reglas de negocio (`RN-01`–`RN-10`)** y los **12 casos de prueba de aceptación (`CP-01`–`CP-12`)** a través de las entregas incrementales **E1–E4**.

---

## 1. Módulos implementados y alcance

| Módulo | Entrega | Historias | Capacidades principales |
| :--- | :---: | :--- | :--- |
| **M0 · `auth` (Seguridad y RBAC)** | E1 | `H7.6` | Autenticación HMAC-SHA256, hash `scrypt`, control de permisos por rol (`ADMIN`, `SECRETARIA`, `TRABAJADOR`) y administración de usuarios. |
| **M1 · `catalog` (Catálogo)** | E1 | `H1.1`–`H1.5` | Alta, consulta, búsqueda, edición de tarifas (solo Admin) y desactivación lógica preservando historial. |
| **M2 · `sales` (Ventas y Clientes)** | E2/E3 | `H2.1`–`H2.7` | Ventas multi-servicio (`1..N`), catálogo de trabajadores y clientes opcionales, descuento en vivo, *snapshot* histórico de precios (`RN-02`), filtros combinados y cancelación con motivo (solo Admin). |
| **M3 · `payments` (Pagos y Abonos)** | E2/E3 | `H3.1`–`H3.5` | Registro de pagos y abonos parciales, cálculo automático de saldo, bloqueo sobre canceladas (`RN-10`), reembolsos, historial (solo Admin) y comprobante imprimible (`@media print`). |
| **M4 · `work-orders` (Servicios Realizados)** | E2/E3 | `H4.1`–`H4.4` | Ciclo de 5 estados independiente de la venta/pago (`RN-09`), aislamiento estricto por trabajador, confirmación como `REALIZADO` y consultas por trabajador/periodo. |
| **M5/M6 · `commissions` (Comisiones)** | E3 | `H5.1`–`H6.5` | Motor desacoplado por eventos (`Strategy + Ledger append-only`), disparador y base configurables, reglas por trabajador/servicio, contra-asientos por cancelación/reembolso e inmutabilidad histórica (`RN-07`). |
| **M7 · `reports` (Reportes y Exportación)** | E4 | `H7.1`–`H7.5` | Reportes de ventas (día/semana/mes), servicios concluidos por trabajador, ingresos reales vs. vendidos por método, comisiones separadas (Trabajadores vs. Secretaria) y exportación CSV. |

> **Fuera del alcance (`Scope Boundary`):** Inventario, venta de productos físicos/mercancía, compras a proveedores, pase de lista semanal y cálculo general de sueldos.

---

## 2. Stack técnico y documentación

- **Backend:** Node.js (`>= 24`, probado en `v26.13.1`) · TypeScript (`strict`) · Express 5 · Zod · `node:sqlite` (WAL + llaves foráneas, 10 tablas normalizadas).
- **Frontend:** React 19 · TypeScript · Vite 6 · CSS nativo responsivo con estilos `@media print`.
- **Calidad y arquitectura:** Biome (`0` warnings), `tsc --noEmit`, `dependency-cruiser` (aislamiento entre slices), escaneo de secretos (`scripts/secret-scan.mjs`), Vitest, Git hooks y GitHub Actions.

### Documentos de ingeniería incluidos en el repositorio
- [Análisis de Requerimientos (PDF)](docs/Analisis_de_Requerimientos_SVAS.pdf) — Visión, `STRQ`, `FEAT`, `RF-01`–`RF-37`, `RN-01`–`RN-10`, Casos de Uso detallados, `OR_01`–`OR_10` y Matriz de Rastreabilidad (RTM).
- [Diagrama de Arquitectura (PDF)](docs/Diagrama_Arquitectura_SVAS.pdf) — Vista de contenedores, módulos, bus de eventos, capas y modelo relacional.
- [AGENTS.md](AGENTS.md) — Reglas operativas, invariantes de dominio y comandos canónicos.
- [FEATURE_MAP.md](FEATURE_MAP.md) — Mapa determinista de cada vertical slice, rutas, pruebas y verificación E2E.

---

## 3. Instalación y ejecución

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/alexcastro51002-cmyk/italika-pos-taller.git
cd italika-pos-taller
npm ci

# 2. Activar hooks locales del repositorio
git config core.hooksPath .githooks

# 3. Levantar API (http://localhost:3001) y Frontend (http://localhost:5173) en dos terminales
npm run dev:api
npm run dev:web
```

Para compilar el frontend para producción:
```bash
npm run build
```

### Usuarios de demostración (Seed automático)

Al iniciar la API por primera vez, se crea automáticamente `data/svas.db` con estos usuarios y 3 servicios iniciales:

| Rol | Correo | Contraseña | Alcance en el sistema |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@svas.local` | `Admin123!` | Acceso total: catálogo/precios, cancelaciones, reembolsos, historial de pagos, configuración de comisiones, reportes/CSV y control de accesos. |
| **Secretaria** | `secretaria@svas.local` | `Secre123!` | Consulta catálogo, registra ventas multi-servicio, cobra pagos/abonos, emite comprobantes, actualiza seguimiento de servicios y consulta su propia comisión. |
| **Trabajador** | `trabajador@svas.local` | `Trab123!` | Consulta únicamente sus servicios asignados, confirma conclusión (`REALIZADO`) y consulta sus propias comisiones por periodo. |

---

## 4. Guía rápida de operación por rol (`OR_09`)

Ciclo operativo del negocio: **Venta (`M2`) → Pago/Abono (`M3`) → Servicio Realizado (`M4`) → Comisión inmutable (`M5/M6`) → Reportes (`M7`)**.

1. **Secretaria / Administrador** registra una venta en **Ventas** seleccionando `1..N` servicios activos, asigna al trabajador y aplica descuento autorizado si corresponde. El precio del servicio queda congelado en la venta (`RN-02`).
2. **Secretaria / Administrador** registra pagos totales o abonos parciales en **Pagos y abonos** y genera el **Comprobante** imprimible. El sistema impide cobrar sobre ventas canceladas o superar el saldo pendiente (`RN-10`).
3. **Trabajador** entra a **Servicios realizados**, ve exclusivamente los servicios asignados a su usuario y marca **Confirmar realizado** al terminar (`RN-09`).
4. **Motor de Comisiones** calcula y guarda el movimiento en el libro mayor inmutable según el disparador configurado (`AL_VENDER`, `AL_REALIZAR` o `AL_LIQUIDAR`). Si el Administrador cancela una venta o registra un reembolso, se genera un contra-asiento de ajuste automático (`RN-06`, `RN-07`).
5. **Administrador** consulta indicadores en **Reportes** filtrados por periodo, servicio o trabajador y exporta a CSV o impresión.

---

## 5. Base de datos SQLite

La base de datos se almacena en `data/svas.db` (ignorada por Git). Puedes inspeccionarla desde la terminal:

```bash
sqlite3 -header -column data/svas.db
```

Comandos útiles dentro de `sqlite3`:
```sql
.tables
SELECT id, nombre, email, rol, activo FROM usuarios;
SELECT folio, fecha_venta, total, estado_venta FROM ventas;
SELECT * FROM venta_detalles;
SELECT * FROM pagos;
SELECT * FROM movimientos_comision;
```

Para reiniciar a los datos de demostración limpios, detén `npm run dev:api`, elimina `data/svas.db*` y vuelve a iniciar la API.

---

## 6. Calidad de software, guardrails y pruebas

Todo cambio pasa por una única compuerta determinista (`npm run check`) antes de poder hacer commit:

```bash
npm run check       # Biome lint + tsc --noEmit + dependency-cruiser + secret-scan + Vitest (12/12)
npm run build       # Compilación de producción con Vite
npm run test:smoke  # Prueba E2E real HTTP levantando API y BD temporal aislada
```

- **Hooks locales (`.githooks/`):** `pre-commit` ejecuta escaneo de secretos staged + `npm run check`; `commit-msg` exige formato **Conventional Commits**.
- **Integración Continua:** [.github/workflows/check.yml](.github/workflows/check.yml) replica `npm run check`, `npm run build` y `npm run test:smoke` en cada `push` o `pull_request` a `main`.

---

## 7. Estructura del proyecto

```text
.
├── .github/workflows/check.yml   # Gatekeeper CI en GitHub Actions
├── .githooks/                    # Hooks pre-commit y commit-msg
├── docs/                         # Análisis de Requerimientos y Diagrama de Arquitectura (PDF)
├── scripts/
│   ├── secret-scan.mjs           # Escáner determinista de secretos
│   └── smoke.ts                  # Verificación E2E real contra servidor HTTP efímero
└── src/
    ├── app.ts / server.ts        # Composition root de Express y Event Bus
    ├── shared/                   # Núcleo mínimo: types.ts, db.ts, security.ts, http.ts, events.ts
    ├── features/                 # Vertical slices independientes (sin cruces entre módulos)
    │   ├── auth/                 # M0: Login, RBAC y gestión de usuarios
    │   ├── catalog/              # M1: Catálogo de servicios
    │   ├── sales/                # M2: Ventas multi-servicio, clientes y cancelaciones
    │   ├── payments/             # M3: Pagos, abonos, reembolsos y comprobantes
    │   ├── work-orders/          # M4: Seguimiento y confirmación de servicios
    │   ├── commissions/          # M5/M6: Strategy + Ledger inmutable de comisiones
    │   └── reports/              # M7: Reportes gerenciales y exportación CSV
    └── web/                      # SPA React + Vite (src/web/pages/*)
```
