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

describe("payments slice (M3 · H3.1–H3.5)", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it("CP-07 & CP-08: registra abonos parciales, rechaza sobrepago, genera comprobante y restringe historial al Admin", async () => {
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

    // Venta de $450 (servicio 2)
    const { sale } = await (
      await fetch(`${srv.baseUrl}/api/sales`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secTok}`,
        },
        body: JSON.stringify({
          clienteNombre: "Laura Méndez",
          fechaVenta: "2026-11-25",
          items: [{ servicioId: 2, trabajadorId: 1 }],
        }),
      })
    ).json();

    // Abono $200
    const p1 = await fetch(`${srv.baseUrl}/api/sales/${sale.id}/payments`, {
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
    expect(p1.status).toBe(201);
    const b1 = await p1.json();
    expect(b1.account.estadoPago).toBe("PARCIALMENTE_PAGADA");
    expect(b1.account.saldoPendiente).toBe(250);

    // Intento de sobrepago ($300 > $250) rechazado
    const overpay = await fetch(
      `${srv.baseUrl}/api/sales/${sale.id}/payments`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secTok}`,
        },
        body: JSON.stringify({ monto: 300, metodoPago: "TARJETA" }),
      },
    );
    expect(overpay.status).toBe(400);

    // Liquidación $250
    const p2 = await fetch(`${srv.baseUrl}/api/sales/${sale.id}/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secTok}`,
      },
      body: JSON.stringify({ monto: 250, metodoPago: "TRANSFERENCIA" }),
    });
    expect(p2.status).toBe(201);
    const b2 = await p2.json();
    expect(b2.account.estadoPago).toBe("LIQUIDADA");
    expect(b2.account.saldoPendiente).toBe(0);

    // Comprobante imprimible
    const receiptRes = await fetch(
      `${srv.baseUrl}/api/sales/${sale.id}/receipt`,
      {
        headers: { authorization: `Bearer ${secTok}` },
      },
    );
    expect(receiptRes.status).toBe(200);
    const { receipt } = await receiptRes.json();
    expect(receipt.pagos).toHaveLength(2);
    expect(receipt.saldoPendiente).toBe(0);

    // Historial H3.5: 403 para Secretaria, 200 para Administrador
    const secHist = await fetch(
      `${srv.baseUrl}/api/sales/${sale.id}/payments`,
      {
        headers: { authorization: `Bearer ${secTok}` },
      },
    );
    expect(secHist.status).toBe(403);

    const adminHist = await fetch(
      `${srv.baseUrl}/api/sales/${sale.id}/payments`,
      {
        headers: { authorization: `Bearer ${adminTok}` },
      },
    );
    expect(adminHist.status).toBe(200);
    expect((await adminHist.json()).payments).toHaveLength(2);
  });

  it("RN-10: bloquea pagos sobre ventas canceladas", async () => {
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

    const { sale } = await (
      await fetch(`${srv.baseUrl}/api/sales`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secTok}`,
        },
        body: JSON.stringify({ items: [{ servicioId: 1, trabajadorId: 1 }] }),
      })
    ).json();

    await fetch(`${srv.baseUrl}/api/sales/${sale.id}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminTok}`,
      },
      body: JSON.stringify({ motivo: "Error de captura" }),
    });

    const payCancelled = await fetch(
      `${srv.baseUrl}/api/sales/${sale.id}/payments`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secTok}`,
        },
        body: JSON.stringify({ monto: 180, metodoPago: "EFECTIVO" }),
      },
    );
    expect(payCancelled.status).toBe(409);
  });
});
