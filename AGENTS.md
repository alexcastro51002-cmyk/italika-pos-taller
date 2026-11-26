# AGENTS.md

## Stack & Layout
- Runtime / Stack: Node.js 26 + TypeScript (`strict`) + Express 5 + `node:sqlite` + Zod + React 19 + Vite.
- Architecture: Vertical slices under `src/features/<module>/` (co-located `schema.ts`, `repo.ts`, `service.ts`, `routes.ts`, `index.ts`, `<module>.test.ts`). Cross-feature imports are forbidden; use `src/shared/events.ts` or `src/shared/`.
- Frontend: `src/web/` may import pure types from `src/shared/types.ts` only (no backend/node imports).
- Navigation: Always check `FEATURE_MAP.md` before searching the codebase or reproducing a bug.

## Canonical Commands
- Install: `npm ci`
- Dev API / Web: `npm run dev:api` | `npm run dev:web`
- Build: `npm run build`
- Gatekeeper (MUST pass before reporting done): `npm run check`
- Real-flow Smoke E2E: `npm run test:smoke`

## Domain Invariants (Non-Negotiable)
- `RN-02`: Freeze `precio_aplicado` and service snapshot in `venta_detalles`; catalog updates never alter past sales.
- `RN-07`: Commissions use an append-only ledger (`movimientos_comision`); rate changes never rewrite historical commissions.
- `RN-08`/`RN-09`: Keep `estado_venta` (`VIGENTE|CANCELADA`), derived payment state, and `estado_servicio` (5 states) independent.
- `OR_04`: Enforce RBAC and row-level ownership in backend middleware/services, never UI-only hiding.

## Hard Constraints
- Never bypass git hooks (`--no-verify`) or weaken Biome, TypeScript, or `dependency-cruiser` rules.
- Never modify `src/shared/` or `package.json` inside a parallel feature worktree; stop and report `BLOCKED`.
- Never use `any` or non-null assertions (`!`), and never commit secrets or `.db` files.
- Never report a task done without fresh passing output from both `npm run check` and `npm run test:smoke`.
