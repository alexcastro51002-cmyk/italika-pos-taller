# Feature Map — SVAS

Mapa determinista de funcionalidades del **Sistema de Venta y Administración de Servicios (SVAS)** hacia sus slices verticales, rutas, pruebas automatizadas y verificación de flujo real.

| Feature | Entrega | Estado | Slice Directory | Entrypoint / UI Route | Automated Check | Real-Flow Verification / Bug Repro |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `auth` (M0 · Acceso y RBAC `H7.6`) | E1 | Implementado | `src/features/auth/` | `POST /api/auth/login`, `GET /api/auth/me`, `GET/POST /api/users`, `PATCH /api/users/:id/permissions` (`Accesos`) | `npx vitest run src/features/auth/auth.test.ts` | `npm run test:smoke` |
| `catalog` (M1 · Catálogo `H1.1–H1.5`) | E1 | Implementado | `src/features/catalog/` | `GET/POST /api/services`, `PUT /api/services/:id`, `PATCH /api/services/:id/status` (`Catálogo`) | `npx vitest run src/features/catalog/catalog.test.ts` | `npm run test:smoke` |
| `sales` (M2 · Ventas y Clientes `H2.1–H2.7`) | E2/E3 | Implementado | `src/features/sales/` | `GET /api/workers`, `GET/POST /api/clients`, `GET/POST /api/sales`, `POST /api/sales/:id/cancel` (`Ventas`) | `npx vitest run src/features/sales/sales.test.ts` | `npm run test:smoke` |
| `payments` (M3 · Pagos y Abonos `H3.1–H3.5`) | E2/E3 | Implementado | `src/features/payments/` | `GET /api/payments/summary`, `GET/POST /api/sales/:id/payments`, `POST /api/sales/:id/refunds`, `GET /api/sales/:id/receipt` (`Pagos`) | `npx vitest run src/features/payments/payments.test.ts` | `npm run test:smoke` |
| `work-orders` (M4 · Servicios Realizados `H4.1–H4.4`) | E2/E3 | Implementado | `src/features/work-orders/` | `GET /api/work-orders`, `PATCH /api/work-orders/:id/status` (`Servicios`) | `npx vitest run src/features/work-orders/work-orders.test.ts` | `npm run test:smoke` |
| `commissions` (M5/M6 · Comisiones `H5–H6`) | E3 | Implementado | `src/features/commissions/` | `GET/PUT /api/commissions/config`, `POST/DELETE /api/commissions/rules`, `GET /api/commissions` (`Comisiones`) | `npx vitest run src/features/commissions/commissions.test.ts` | `npm run test:smoke` |
| `reports` (M7 · Reportes y Exportación `H7.1–H7.5`) | E4 | Implementado | `src/features/reports/` | `GET /api/reports/{sales,services,income,commissions}`, `GET /api/reports/:type/export` (`Reportes`) | `npx vitest run src/features/reports/reports.test.ts` | `npm run test:smoke` |
