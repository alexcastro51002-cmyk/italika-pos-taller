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

describe("commissions slice (M5/M6 · H5.1–H6.5)", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it("CP-10 & CP-11: calcula comisiones inmutables, aplica reglas específicas y revierte al cancelar venta", async () => {
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

    // Configura regla específica: Trabajador 1 en servicio 2 (Diseño $450) gana 20%
    const ruleRes = await fetch(`${srv.baseUrl}/api/commissions/rules`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminTok}`,
      },
      body: JSON.stringify({
        trabajadorId: 1,
        servicioId: 2,
        porcentaje: 20,
      }),
    });
    expect(ruleRes.status).toBe(201);

    // Secretaria registra venta de $450 (genera 5% secretaria = $22.50 al vender)
    const { sale } = await (
      await fetch(`${srv.baseUrl}/api/sales`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secTok}`,
        },
        body: JSON.stringify({
          fechaVenta: "2026-11-25",
          items: [{ servicioId: 2, trabajadorId: 1 }],
        }),
      })
    ).json();

    // Trabajador confirma servicio -> devenga 20% de $450 = $90
    await fetch(
      `${srv.baseUrl}/api/work-orders/${sale.detalles[0].id}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${trabTok}`,
        },
        body: JSON.stringify({ estado: "REALIZADO" }),
      },
    );

    // Cambiamos tasas globales y regla posterior -> las comisiones ya devengadas NO cambian (RN-07)
    await fetch(`${srv.baseUrl}/api/commissions/config`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminTok}`,
      },
      body: JSON.stringify({
        disparadorTrabajador: "AL_REALIZAR",
        disparadorSecretaria: "AL_VENDER",
        baseElegible: "NETO_POST_DESCUENTO",
        secSoloVentasPropias: true,
        tasaTrabajadorGlobal: 50,
        tasaSecretariaGlobal: 25,
      }),
    });

    const trabComm = await (
      await fetch(`${srv.baseUrl}/api/commissions`, {
        headers: { authorization: `Bearer ${trabTok}` },
      })
    ).json();
    expect(trabComm.totals.trabajadoresNeto).toBe(90);
    expect(trabComm.totals.secretariaNeto).toBe(0); // Trabajador solo ve lo suyo

    const secComm = await (
      await fetch(`${srv.baseUrl}/api/commissions`, {
        headers: { authorization: `Bearer ${secTok}` },
      })
    ).json();
    expect(secComm.totals.secretariaNeto).toBe(22.5);
    expect(secComm.totals.trabajadoresNeto).toBe(0); // Secretaria solo ve lo suyo

    // Cancelar venta genera contra-asientos auditables dejando neto en $0 (CP-11)
    await fetch(`${srv.baseUrl}/api/sales/${sale.id}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminTok}`,
      },
      body: JSON.stringify({ motivo: "Devolución total" }),
    });

    const adminComm = await (
      await fetch(`${srv.baseUrl}/api/commissions`, {
        headers: { authorization: `Bearer ${adminTok}` },
      })
    ).json();
    expect(adminComm.totals.totalGeneral).toBe(0);
    expect(adminComm.movements).toHaveLength(4); // 2 devengadas + 2 ajustes
  });
});
