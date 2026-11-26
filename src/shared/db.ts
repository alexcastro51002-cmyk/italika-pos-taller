import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./security.js";

export function createDatabase(dbPath = "data/svas.db"): DatabaseSync {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  if (dbPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  initSchema(db);
  return db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('ADMIN', 'SECRETARIA', 'TRABAJADOR')),
      permisos_extra TEXT NOT NULL DEFAULT '[]',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trabajadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL DEFAULT '',
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL DEFAULT '',
      correo TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS servicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT NOT NULL DEFAULT '',
      precio_base REAL NOT NULL CHECK (precio_base >= 0),
      duracion_min INTEGER NOT NULL CHECK (duracion_min >= 1),
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT NOT NULL UNIQUE,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      registrado_por INTEGER NOT NULL REFERENCES usuarios(id),
      fecha_venta TEXT NOT NULL,
      subtotal REAL NOT NULL CHECK (subtotal >= 0),
      descuento_autorizado REAL NOT NULL DEFAULT 0 CHECK (descuento_autorizado >= 0),
      total REAL NOT NULL CHECK (total >= 0),
      estado_venta TEXT NOT NULL DEFAULT 'VIGENTE' CHECK (estado_venta IN ('VIGENTE', 'CANCELADA')),
      motivo_cancelacion TEXT,
      cancelado_por INTEGER REFERENCES usuarios(id),
      cancelado_en TEXT
    );

    CREATE TABLE IF NOT EXISTS venta_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      servicio_id INTEGER NOT NULL REFERENCES servicios(id),
      servicio_nombre_snap TEXT NOT NULL,
      precio_aplicado REAL NOT NULL CHECK (precio_aplicado >= 0),
      trabajador_id INTEGER REFERENCES trabajadores(id),
      fecha_programada TEXT,
      estado_servicio TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (
        estado_servicio IN ('PENDIENTE', 'PROGRAMADO', 'EN_PROCESO', 'REALIZADO', 'CANCELADO')
      ),
      fecha_realizacion TEXT,
      confirmado_por INTEGER REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      monto REAL NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('PAGO', 'REEMBOLSO')),
      metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO')),
      fecha_pago TEXT NOT NULL,
      registrado_por INTEGER NOT NULL REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS configuracion_negocio (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      disparador_comision_trab TEXT NOT NULL DEFAULT 'AL_REALIZAR' CHECK (
        disparador_comision_trab IN ('AL_VENDER', 'AL_REALIZAR', 'AL_LIQUIDAR')
      ),
      disparador_comision_sec TEXT NOT NULL DEFAULT 'AL_VENDER' CHECK (
        disparador_comision_sec IN ('AL_VENDER', 'AL_REALIZAR', 'AL_LIQUIDAR')
      ),
      base_elegible TEXT NOT NULL DEFAULT 'NETO_POST_DESCUENTO' CHECK (
        base_elegible IN ('BRUTO', 'NETO_POST_DESCUENTO', 'COBRADO_REAL')
      ),
      sec_solo_ventas_propias INTEGER NOT NULL DEFAULT 1,
      tasa_trabajador_global REAL NOT NULL DEFAULT 10,
      tasa_secretaria_global REAL NOT NULL DEFAULT 5
    );

    CREATE TABLE IF NOT EXISTS reglas_comision (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_id INTEGER REFERENCES trabajadores(id) ON DELETE CASCADE,
      servicio_id INTEGER REFERENCES servicios(id) ON DELETE CASCADE,
      porcentaje REAL NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS movimientos_comision (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      beneficiario_tipo TEXT NOT NULL CHECK (beneficiario_tipo IN ('TRABAJADOR', 'SECRETARIA')),
      beneficiario_id INTEGER NOT NULL,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      venta_detalle_id INTEGER REFERENCES venta_detalles(id),
      base_elegible REAL NOT NULL,
      porcentaje_aplicado REAL NOT NULL,
      monto REAL NOT NULL,
      tipo_movimiento TEXT NOT NULL CHECK (
        tipo_movimiento IN ('DEVENGADA', 'AJUSTE_CANCELACION', 'AJUSTE_REEMBOLSO')
      ),
      fecha_registro TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function seedDatabase(db: DatabaseSync): void {
  const userCount = db
    .prepare("SELECT COUNT(*) AS count FROM usuarios")
    .get() as { count: number };

  if (userCount.count === 0) {
    const insertUser = db.prepare(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, permisos_extra, activo)
       VALUES (?, ?, ?, ?, '[]', 1)`,
    );
    insertUser.run(
      "Administrador General",
      "admin@svas.local",
      hashPassword("Admin123!"),
      "ADMIN",
    );
    insertUser.run(
      "Secretaria Recepción",
      "secretaria@svas.local",
      hashPassword("Secre123!"),
      "SECRETARIA",
    );
    const trabRes = insertUser.run(
      "Carlos Mendoza",
      "trabajador@svas.local",
      hashPassword("Trab123!"),
      "TRABAJADOR",
    );

    db.prepare(
      `INSERT INTO trabajadores (usuario_id, nombre, telefono, activo)
       VALUES (?, ?, ?, 1)`,
    ).run(Number(trabRes.lastInsertRowid), "Carlos Mendoza", "6441000001");
  }

  const serviceCount = db
    .prepare("SELECT COUNT(*) AS count FROM servicios")
    .get() as { count: number };

  if (serviceCount.count === 0) {
    const insertService = db.prepare(
      `INSERT INTO servicios (nombre, descripcion, precio_base, duracion_min, activo)
       VALUES (?, ?, ?, ?, 1)`,
    );
    insertService.run(
      "Corte de cabello",
      "Servicio general de corte y peinado",
      180,
      45,
    );
    insertService.run(
      "Diseño de imagen",
      "Asesoría y diseño personalizado",
      450,
      90,
    );
    insertService.run(
      "Tratamiento especializado",
      "Servicio integral por sesión",
      650,
      60,
    );
  }

  db.prepare(
    `INSERT OR IGNORE INTO configuracion_negocio (
      id, disparador_comision_trab, disparador_comision_sec,
      base_elegible, sec_solo_ventas_propias,
      tasa_trabajador_global, tasa_secretaria_global
    ) VALUES (1, 'AL_REALIZAR', 'AL_VENDER', 'NETO_POST_DESCUENTO', 1, 10, 5)`,
  ).run();
}
