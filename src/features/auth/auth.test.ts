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

async function loginAs(baseUrl: string, email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, data: await res.json() };
}

describe("auth slice (M0 · H7.6)", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it("permite login válido y rechaza credenciales incorrectas", async () => {
    const srv = await startTestServer();
    cleanups.push(srv.close);

    const ok = await loginAs(srv.baseUrl, "admin@svas.local", "Admin123!");
    expect(ok.status).toBe(200);
    expect(ok.data.token).toBeTypeOf("string");
    expect(ok.data.user.rol).toBe("ADMIN");

    const bad = await loginAs(srv.baseUrl, "admin@svas.local", "WrongPass!");
    expect(bad.status).toBe(401);
  });

  it("protege /api/auth/me sin token y bloquea gestión de usuarios a Secretaria y Trabajador", async () => {
    const srv = await startTestServer();
    cleanups.push(srv.close);

    const noAuth = await fetch(`${srv.baseUrl}/api/auth/me`);
    expect(noAuth.status).toBe(401);

    const sec = await loginAs(
      srv.baseUrl,
      "secretaria@svas.local",
      "Secre123!",
    );
    const secUsers = await fetch(`${srv.baseUrl}/api/users`, {
      headers: { authorization: `Bearer ${sec.data.token}` },
    });
    expect(secUsers.status).toBe(403);

    const trab = await loginAs(
      srv.baseUrl,
      "trabajador@svas.local",
      "Trab123!",
    );
    const trabUsers = await fetch(`${srv.baseUrl}/api/users`, {
      headers: { authorization: `Bearer ${trab.data.token}` },
    });
    expect(trabUsers.status).toBe(403);
  });

  it("permite al Administrador crear usuarios, vincular trabajador y actualizar permisos", async () => {
    const srv = await startTestServer();
    cleanups.push(srv.close);

    const admin = await loginAs(srv.baseUrl, "admin@svas.local", "Admin123!");
    const createRes = await fetch(`${srv.baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${admin.data.token}`,
      },
      body: JSON.stringify({
        nombre: "Lucía Torres",
        email: "lucia@svas.local",
        password: "ClaveSegura1!",
        rol: "TRABAJADOR",
        telefono: "6441112233",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.user.trabajadorId).toBeTypeOf("number");

    const patchRes = await fetch(
      `${srv.baseUrl}/api/users/${created.user.id}/permissions`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${admin.data.token}`,
        },
        body: JSON.stringify({
          permisosExtra: ["catalog:read"],
          activo: false,
        }),
      },
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.user.activo).toBe(false);
    expect(patched.user.permisosEfectivos).toContain("catalog:read");

    const inactiveLogin = await loginAs(
      srv.baseUrl,
      "lucia@svas.local",
      "ClaveSegura1!",
    );
    expect(inactiveLogin.status).toBe(403);
  });
});
