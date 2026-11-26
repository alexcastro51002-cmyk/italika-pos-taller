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

describe("work-orders slice (M4 · H4.1–H4.4)", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it("CP-01 & CP-09: separa estado de servicio de pago, aísla órdenes por trabajador y solo permite confirmar Realizado al trabajador", async () => {
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
    const trab1Tok = await getToken(
      srv.baseUrl,
      "trabajador@svas.local",
      "Trab123!",
    );

    // Crear un segundo trabajador
    const trab2Create = await (
      await fetch(`${srv.baseUrl}/api/users`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${adminTok}`,
        },
        body: JSON.stringify({
          nombre: "Sofía Ramírez",
          email: "sofia@svas.local",
          password: "Password1!",
          rol: "TRABAJADOR",
        }),
      })
    ).json();
    const trab2Id = trab2Create.user.trabajadorId as number;

    // Venta con 1 detalle para trabajador 1 y 1 detalle para trabajador 2
    const { sale } = await (
      await fetch(`${srv.baseUrl}/api/sales`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secTok}`,
        },
        body: JSON.stringify({
          items: [
            { servicioId: 1, trabajadorId: 1 },
            { servicioId: 2, trabajadorId: trab2Id },
          ],
        }),
      })
    ).json();

    // Trabajador 1 solo ve su orden (1 de 2)
    const trab1Orders = await (
      await fetch(`${srv.baseUrl}/api/work-orders`, {
        headers: { authorization: `Bearer ${trab1Tok}` },
      })
    ).json();
    expect(trab1Orders.orders).toHaveLength(1);
    expect(trab1Orders.orders[0].id).toBe(sale.detalles[0].id);

    // Trabajador 1 no puede modificar la orden de Sofía (403)
    const forbiddenOther = await fetch(
      `${srv.baseUrl}/api/work-orders/${sale.detalles[1].id}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${trab1Tok}`,
        },
        body: JSON.stringify({ estado: "REALIZADO" }),
      },
    );
    expect(forbiddenOther.status).toBe(403);

    // Trabajador 1 no puede cancelar su orden (403)
    const forbiddenCancel = await fetch(
      `${srv.baseUrl}/api/work-orders/${sale.detalles[0].id}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${trab1Tok}`,
        },
        body: JSON.stringify({ estado: "CANCELADO" }),
      },
    );
    expect(forbiddenCancel.status).toBe(403);

    // Trabajador 1 confirma su servicio como REALIZADO sin afectar el estado de pago (sigue PENDIENTE)
    const confirmOk = await fetch(
      `${srv.baseUrl}/api/work-orders/${sale.detalles[0].id}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${trab1Tok}`,
        },
        body: JSON.stringify({ estado: "REALIZADO" }),
      },
    );
    expect(confirmOk.status).toBe(200);
    const updatedOrder = await confirmOk.json();
    expect(updatedOrder.order.estadoServicio).toBe("REALIZADO");
    expect(updatedOrder.order.fechaRealizacion).toBeTypeOf("string");

    const salesCheck = await (
      await fetch(`${srv.baseUrl}/api/sales`, {
        headers: { authorization: `Bearer ${secTok}` },
      })
    ).json();
    expect(salesCheck.sales[0].estadoPago).toBe("PENDIENTE");
  });
});
