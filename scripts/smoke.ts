import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { createDatabase, seedDatabase } from "../src/shared/db.js";

async function login(base: string, email: string, password: string) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `Login falló para ${email}`);
  return (await res.json()) as { token: string };
}

async function runSmoke() {
  const tempDir = mkdtempSync(join(tmpdir(), "svas-smoke-"));
  const dbPath = join(tempDir, "smoke.db");
  const db = createDatabase(dbPath);
  seedDatabase(db);
  const app = createApp(db);

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Healthcheck y logins por rol
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);

    const { token: adminTok } = await login(
      base,
      "admin@svas.local",
      "Admin123!",
    );
    const { token: secTok } = await login(
      base,
      "secretaria@svas.local",
      "Secre123!",
    );
    const { token: trabTok } = await login(
      base,
      "trabajador@svas.local",
      "Trab123!",
    );

    // 2. M1 Catálogo + RBAC (CP-01, CP-03)
    const secEditPrice = await fetch(`${base}/api/services/1`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secTok}`,
      },
      body: JSON.stringify({
        nombre: "Corte",
        descripcion: "Hack",
        precioBase: 1,
        duracionMin: 10,
      }),
    });
    assert.equal(secEditPrice.status, 403);

    // 3. M2 Venta multi-servicio con descuento ($180 + $450 - $30 = $600) + Snapshot RN-02 (CP-02, CP-04)
    const saleRes = await fetch(`${base}/api/sales`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secTok}`,
      },
      body: JSON.stringify({
        clienteNombre: "Cliente Smoke",
        fechaVenta: "2026-11-25",
        descuentoAutorizado: 30,
        items: [
          { servicioId: 1, trabajadorId: 1, fechaProgramada: "2026-11-26" },
          { servicioId: 2, trabajadorId: 1, fechaProgramada: "2026-11-26" },
        ],
      }),
    });
    assert.equal(saleRes.status, 201);
    const { sale } = (await saleRes.json()) as {
      sale: { id: number; total: number; detalles: Array<{ id: number }> };
    };
    assert.equal(sale.total, 600);

    // Subir precio en catálogo no cambia venta previa
    await fetch(`${base}/api/services/1`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminTok}`,
      },
      body: JSON.stringify({
        nombre: "Corte de cabello",
        descripcion: "Nuevo precio",
        precioBase: 300,
        duracionMin: 45,
      }),
    });

    // 4. M3 Pagos parciales, sobrepago bloqueado, comprobante e historial (CP-07, CP-08)
    const pay1 = await fetch(`${base}/api/sales/${sale.id}/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secTok}`,
      },
      body: JSON.stringify({
        monto: 250,
        metodoPago: "EFECTIVO",
        fechaPago: "2026-11-25",
      }),
    });
    assert.equal(pay1.status, 201);

    const overpay = await fetch(`${base}/api/sales/${sale.id}/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secTok}`,
      },
      body: JSON.stringify({ monto: 500, metodoPago: "TARJETA" }),
    });
    assert.equal(overpay.status, 400);

    const receiptRes = await fetch(`${base}/api/sales/${sale.id}/receipt`, {
      headers: { authorization: `Bearer ${secTok}` },
    });
    assert.equal(receiptRes.status, 200);

    // 5. M4 Trabajador confirma servicio Realizado (CP-09)
    const detailId = sale.detalles[0]?.id ?? 0;
    const confirmRes = await fetch(
      `${base}/api/work-orders/${detailId}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${trabTok}`,
        },
        body: JSON.stringify({ estado: "REALIZADO" }),
      },
    );
    assert.equal(confirmRes.status, 200);

    // 6. M5/M6 Comisiones devengadas y visibles por rol (CP-10)
    const trabComm = (await (
      await fetch(`${base}/api/commissions`, {
        headers: { authorization: `Bearer ${trabTok}` },
      })
    ).json()) as { totals: { trabajadoresNeto: number } };
    assert.ok(trabComm.totals.trabajadoresNeto > 0);

    const secComm = (await (
      await fetch(`${base}/api/commissions`, {
        headers: { authorization: `Bearer ${secTok}` },
      })
    ).json()) as { totals: { secretariaNeto: number } };
    assert.equal(secComm.totals.secretariaNeto, 30); // 5% de $600

    // 7. M7 Reportes + CSV export (CP-12)
    const incRep = (await (
      await fetch(`${base}/api/reports/income`, {
        headers: { authorization: `Bearer ${adminTok}` },
      })
    ).json()) as {
      report: {
        totales: { totalCobradoNeto: number; saldoPendienteTotal: number };
      };
    };
    assert.equal(incRep.report.totales.totalCobradoNeto, 250);
    assert.equal(incRep.report.totales.saldoPendienteTotal, 350);

    const csvRes = await fetch(`${base}/api/reports/sales/export`, {
      headers: { authorization: `Bearer ${adminTok}` },
    });
    assert.equal(csvRes.status, 200);
    assert.ok((await csvRes.text()).includes("Cliente Smoke"));

    // 8. Cancelación con motivo + ajuste de comisiones (CP-06, CP-11)
    const cancelRes = await fetch(`${base}/api/sales/${sale.id}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminTok}`,
      },
      body: JSON.stringify({ motivo: "Cancelación de prueba smoke" }),
    });
    assert.equal(cancelRes.status, 200);

    const adminCommAfter = (await (
      await fetch(`${base}/api/commissions`, {
        headers: { authorization: `Bearer ${adminTok}` },
      })
    ).json()) as { totals: { totalGeneral: number } };
    assert.equal(adminCommAfter.totals.totalGeneral, 0);

    console.log(
      "SMOKE E2E OK: flujos completos E1–E4 (auth, catalog, sales, payments, work-orders, commissions, reports + CSV) verificados.",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

runSmoke().catch((err) => {
  console.error("SMOKE E2E FAILED:", err);
  process.exit(1);
});
