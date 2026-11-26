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

describe("sales slice (M2 · H2.1–H2.7)", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it("CP-02 & CP-04: registra venta multi-servicio con descuento y congela precio histórico aunque cambie el catálogo", async () => {
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

    // Descuento mayor al subtotal rechazado (400)
    const badDisc = await fetch(`${srv.baseUrl}/api/sales`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secTok}`,
      },
      body: JSON.stringify({
        clienteNombre: "María López",
        fechaVenta: "2026-11-25",
        descuentoAutorizado: 999,
        items: [{ servicioId: 1, trabajadorId: 1 }],
      }),
    });
    expect(badDisc.status).toBe(400);

    // Venta con 2 servicios ($180 + $450 = $630) - $30 = $600
    const saleRes = await fetch(`${srv.baseUrl}/api/sales`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secTok}`,
      },
      body: JSON.stringify({
        clienteNombre: "María López",
        fechaVenta: "2026-11-25",
        descuentoAutorizado: 30,
        items: [
          { servicioId: 1, trabajadorId: 1, fechaProgramada: "2026-11-26" },
          { servicioId: 2, trabajadorId: 1, fechaProgramada: "2026-11-26" },
        ],
      }),
    });
    expect(saleRes.status).toBe(201);
    const { sale } = await saleRes.json();
    expect(sale.subtotal).toBe(630);
    expect(sale.total).toBe(600);
    expect(sale.detalles).toHaveLength(2);

    // Admin sube precio del servicio 1 de $180 a $300
    await fetch(`${srv.baseUrl}/api/services/1`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminTok}`,
      },
      body: JSON.stringify({
        nombre: "Corte de cabello",
        descripcion: "Actualizado",
        precioBase: 300,
        duracionMin: 45,
      }),
    });

    // La venta previa conserva precio histórico $180 y total $600
    const salesAfter = await (
      await fetch(`${srv.baseUrl}/api/sales`, {
        headers: { authorization: `Bearer ${secTok}` },
      })
    ).json();
    expect(salesAfter.sales[0].total).toBe(600);
    expect(salesAfter.sales[0].detalles[0].precioAplicado).toBe(180);
  });

  it("CP-05 & CP-06: filtra ventas por trabajador/fecha y restringe cancelación con motivo al Administrador", async () => {
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

    const created = await (
      await fetch(`${srv.baseUrl}/api/sales`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secTok}`,
        },
        body: JSON.stringify({
          clienteNombre: "Pedro Ruiz",
          fechaVenta: "2026-11-20",
          items: [{ servicioId: 1, trabajadorId: 1 }],
        }),
      })
    ).json();

    const filtered = await (
      await fetch(
        `${srv.baseUrl}/api/sales?workerId=1&from=2026-11-19&to=2026-11-21`,
        { headers: { authorization: `Bearer ${secTok}` } },
      )
    ).json();
    expect(filtered.sales).toHaveLength(1);

    // Secretaria no puede cancelar
    const secCancel = await fetch(
      `${srv.baseUrl}/api/sales/${created.sale.id}/cancel`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secTok}`,
        },
        body: JSON.stringify({ motivo: "Intento secretaria" }),
      },
    );
    expect(secCancel.status).toBe(403);

    // Admin cancela exigiendo motivo
    const adminCancel = await fetch(
      `${srv.baseUrl}/api/sales/${created.sale.id}/cancel`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${adminTok}`,
        },
        body: JSON.stringify({ motivo: "Cliente reprogramó indefinidamente" }),
      },
    );
    expect(adminCancel.status).toBe(200);
    const body = await adminCancel.json();
    expect(body.sale.estadoVenta).toBe("CANCELADA");
    expect(body.sale.motivoCancelacion).toContain("reprogramó");
  });
});
