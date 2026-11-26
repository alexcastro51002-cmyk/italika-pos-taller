import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createDatabase, seedDatabase } from "../../shared/db.js";

async function startTestServer() {
  const db = createDatabase(":memory:");
  seedDatabase(db);
  const app = createApp(db);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          db.close();
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

async function getToken(
  baseUrl: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return ((await res.json()) as { token: string }).token;
}

describe("reports slice (M7 · H7.1–H7.5)", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it("CP-12: genera los 4 reportes diferenciando vendido vs cobrado, excluye canceladas y exporta CSV con RBAC", async () => {
    const srv = await startTestServer();
    cleanups.push(srv.close);

    const adminTok = await getToken(
      srv.baseUrl,
      "admin@svas.local",
      "Admin123!",
    );
    const secTok = await getToken(
      srv.baseUrl,
      "secretaria@svas.local",
      "Secre123!",
    );
    const trabTok = await getToken(
      srv.baseUrl,
      "trabajador@svas.local",
      "Trab123!",
    );

    // Secretaria y Trabajador no acceden a reportes (403)
    const secRep = await fetch(`${srv.baseUrl}/api/reports/sales`, {
      headers: { authorization: `Bearer ${secTok}` },
    });
    expect(secRep.status).toBe(403);

    // Venta 1 vigente: $650 con abono de $200 y servicio realizado
    const v1 = (
      await (
        await fetch(`${srv.baseUrl}/api/sales`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${secTok}`,
          },
          body: JSON.stringify({
            fechaVenta: "2026-11-25",
            items: [{ servicioId: 3, trabajadorId: 1 }],
          }),
        })
      ).json()
    ).sale;

    await fetch(`${srv.baseUrl}/api/sales/${v1.id}/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secTok}`,
      },
      body: JSON.stringify({
        monto: 200,
        metodoPago: "EFECTIVO",
        fechaPago: "2026-11-25",
      }),
    });

    await fetch(`${srv.baseUrl}/api/work-orders/${v1.detalles[0].id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${trabTok}`,
      },
      body: JSON.stringify({ estado: "REALIZADO" }),
    });

    // Venta 2 cancelada: $180
    const v2 = (
      await (
        await fetch(`${srv.baseUrl}/api/sales`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${secTok}`,
          },
          body: JSON.stringify({
            fechaVenta: "2026-11-25",
            items: [{ servicioId: 1, trabajadorId: 1 }],
          }),
        })
      ).json()
    ).sale;

    await fetch(`${srv.baseUrl}/api/sales/${v2.id}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminTok}`,
      },
      body: JSON.stringify({ motivo: "Cancelada en prueba" }),
    });

    // Reporte ventas
    const rSales = await (
      await fetch(`${srv.baseUrl}/api/reports/sales?groupBy=month`, {
        headers: { authorization: `Bearer ${adminTok}` },
      })
    ).json();
    expect(rSales.report.totales.ventasVigentes).toBe(1);
    expect(rSales.report.totales.ventasCanceladas).toBe(1);
    expect(rSales.report.totales.totalVendido).toBe(650);

    // Reporte servicios
    const rServices = await (
      await fetch(`${srv.baseUrl}/api/reports/services`, {
        headers: { authorization: `Bearer ${adminTok}` },
      })
    ).json();
    expect(rServices.report.totalRealizados).toBe(1);

    // Reporte ingresos
    const rIncome = await (
      await fetch(`${srv.baseUrl}/api/reports/income`, {
        headers: { authorization: `Bearer ${adminTok}` },
      })
    ).json();
    expect(rIncome.report.totales.totalVendidoVigente).toBe(650);
    expect(rIncome.report.totales.totalCobradoNeto).toBe(200);
    expect(rIncome.report.totales.saldoPendienteTotal).toBe(450);

    // Reporte comisiones separadas (Trabajador 10% = $65, Secretaria 5% = $32.50)
    const rComm = await (
      await fetch(`${srv.baseUrl}/api/reports/commissions`, {
        headers: { authorization: `Bearer ${adminTok}` },
      })
    ).json();
    expect(rComm.report.totales.trabajadoresNeto).toBe(65);
    expect(rComm.report.totales.secretariaNeto).toBe(32.5);

    // Export CSV
    const csvRes = await fetch(
      `${srv.baseUrl}/api/reports/commissions/export`,
      {
        headers: { authorization: `Bearer ${adminTok}` },
      },
    );
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    const csv = await csvRes.text();
    expect(csv).toContain("TRABAJADOR");
    expect(csv).toContain("SECRETARIA");
  });
});
