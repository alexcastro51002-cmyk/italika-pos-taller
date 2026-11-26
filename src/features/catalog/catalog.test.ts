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
  const body = (await res.json()) as { token: string };
  return body.token;
}

describe("catalog slice (M1 · H1.1–H1.5)", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it("aplica RBAC: Secretaria consulta catálogo pero no crea/edita precios; Trabajador recibe 403", async () => {
    const srv = await startTestServer();
    cleanups.push(srv.close);

    const secToken = await getToken(
      srv.baseUrl,
      "secretaria@svas.local",
      "Secre123!",
    );
    const trabToken = await getToken(
      srv.baseUrl,
      "trabajador@svas.local",
      "Trab123!",
    );

    const secList = await fetch(`${srv.baseUrl}/api/services`, {
      headers: { authorization: `Bearer ${secToken}` },
    });
    expect(secList.status).toBe(200);
    const listBody = await secList.json();
    expect(listBody.services.length).toBeGreaterThanOrEqual(3);

    const secCreate = await fetch(`${srv.baseUrl}/api/services`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secToken}`,
      },
      body: JSON.stringify({
        nombre: "Servicio no autorizado",
        descripcion: "Intento de secretaria",
        precioBase: 100,
        duracionMin: 30,
      }),
    });
    expect(secCreate.status).toBe(403);

    const secPriceUpdate = await fetch(`${srv.baseUrl}/api/services/1`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secToken}`,
      },
      body: JSON.stringify({
        nombre: "Corte de cabello",
        descripcion: "Cambio precio",
        precioBase: 999,
        duracionMin: 45,
      }),
    });
    expect(secPriceUpdate.status).toBe(403);

    const trabList = await fetch(`${srv.baseUrl}/api/services`, {
      headers: { authorization: `Bearer ${trabToken}` },
    });
    expect(trabList.status).toBe(403);
  });

  it("permite al Administrador crear, actualizar, desactivar lógicamente y filtrar servicios", async () => {
    const srv = await startTestServer();
    cleanups.push(srv.close);

    const adminToken = await getToken(
      srv.baseUrl,
      "admin@svas.local",
      "Admin123!",
    );

    // Validación de integridad (OR_03): precio negativo rechazado
    const invalid = await fetch(`${srv.baseUrl}/api/services`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: "Servicio inválido",
        precioBase: -10,
        duracionMin: 0,
      }),
    });
    expect(invalid.status).toBe(400);

    // Crear servicio válido
    const createRes = await fetch(`${srv.baseUrl}/api/services`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nombre: "Colorimetría avanzada",
        descripcion: "Aplicación profesional",
        precioBase: 850,
        duracionMin: 120,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Editar precio y duración
    const updateRes = await fetch(
      `${srv.baseUrl}/api/services/${created.service.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nombre: "Colorimetría avanzada",
          descripcion: "Actualizada",
          precioBase: 920,
          duracionMin: 130,
        }),
      },
    );
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.service.precioBase).toBe(920);

    // Desactivar lógicamente (H1.4)
    const deactivateRes = await fetch(
      `${srv.baseUrl}/api/services/${created.service.id}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ activo: false }),
      },
    );
    expect(deactivateRes.status).toBe(200);
    const deactivated = await deactivateRes.json();
    expect(deactivated.service.activo).toBe(false);

    // Verificar filtro active=true excluye el inactivo, active=all lo conserva
    const activeOnly = await (
      await fetch(`${srv.baseUrl}/api/services?active=true&q=Colorimetría`, {
        headers: { authorization: `Bearer ${adminToken}` },
      })
    ).json();
    expect(activeOnly.services).toHaveLength(0);

    const allSearch = await (
      await fetch(`${srv.baseUrl}/api/services?active=all&q=Colorimetría`, {
        headers: { authorization: `Bearer ${adminToken}` },
      })
    ).json();
    expect(allSearch.services).toHaveLength(1);
    expect(allSearch.services[0].activo).toBe(false);
  });
});
