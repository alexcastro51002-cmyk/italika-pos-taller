import type { DatabaseSync } from "node:sqlite";
import {
  type Permission,
  type Role,
  type UserDTO,
  resolveEffectivePermissions,
} from "../../shared/types.js";

export interface UserRow {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: Role;
  permisos_extra: string;
  activo: number;
  creado_en: string;
  trabajador_id: number | null;
}

function mapRowToDto(row: UserRow): UserDTO {
  const extra = JSON.parse(row.permisos_extra) as Permission[];
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    rol: row.rol,
    permisosExtra: extra,
    permisosEfectivos: resolveEffectivePermissions(row.rol, extra),
    trabajadorId: row.trabajador_id ?? null,
    activo: row.activo === 1,
    creadoEn: row.creado_en,
  };
}

export class AuthRepository {
  constructor(private readonly db: DatabaseSync) {}

  findByEmail(email: string): UserRow | undefined {
    return this.db
      .prepare(
        `SELECT u.*, t.id AS trabajador_id
         FROM usuarios u
         LEFT JOIN trabajadores t ON t.usuario_id = u.id
         WHERE LOWER(u.email) = LOWER(?)`,
      )
      .get(email) as UserRow | undefined;
  }

  findById(id: number): UserDTO | undefined {
    const row = this.db
      .prepare(
        `SELECT u.*, t.id AS trabajador_id
         FROM usuarios u
         LEFT JOIN trabajadores t ON t.usuario_id = u.id
         WHERE u.id = ?`,
      )
      .get(id) as UserRow | undefined;
    return row ? mapRowToDto(row) : undefined;
  }

  listUsers(): UserDTO[] {
    const rows = this.db
      .prepare(
        `SELECT u.*, t.id AS trabajador_id
         FROM usuarios u
         LEFT JOIN trabajadores t ON t.usuario_id = u.id
         ORDER BY u.id ASC`,
      )
      .all() as unknown as UserRow[];
    return rows.map(mapRowToDto);
  }

  countActiveAdmins(): number {
    const res = this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM usuarios WHERE rol = 'ADMIN' AND activo = 1",
      )
      .get() as { count: number };
    return res.count;
  }

  createUser(params: {
    nombre: string;
    email: string;
    passwordHash: string;
    rol: Role;
    permisosExtra: Permission[];
    telefono: string;
  }): UserDTO {
    this.db.exec("BEGIN");
    try {
      const insertRes = this.db
        .prepare(
          `INSERT INTO usuarios (nombre, email, password_hash, rol, permisos_extra, activo)
           VALUES (?, ?, ?, ?, ?, 1)`,
        )
        .run(
          params.nombre,
          params.email,
          params.passwordHash,
          params.rol,
          JSON.stringify(params.permisosExtra),
        );
      const userId = Number(insertRes.lastInsertRowid);
      if (params.rol === "TRABAJADOR") {
        this.db
          .prepare(
            `INSERT INTO trabajadores (usuario_id, nombre, telefono, activo)
             VALUES (?, ?, ?, 1)`,
          )
          .run(userId, params.nombre, params.telefono);
      }
      this.db.exec("COMMIT");
      const created = this.findById(userId);
      if (!created) {
        throw new Error("No se pudo recuperar el usuario recién creado.");
      }
      return created;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  updatePermissions(
    id: number,
    updates: {
      rol?: Role;
      permisosExtra?: Permission[];
      activo?: boolean;
    },
  ): UserDTO | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const nextRole = updates.rol ?? existing.rol;
    const nextExtra = updates.permisosExtra ?? existing.permisosExtra;
    const nextActivo = updates.activo ?? existing.activo;

    this.db.exec("BEGIN");
    try {
      this.db
        .prepare(
          `UPDATE usuarios
           SET rol = ?, permisos_extra = ?, activo = ?
           WHERE id = ?`,
        )
        .run(nextRole, JSON.stringify(nextExtra), nextActivo ? 1 : 0, id);

      if (nextRole === "TRABAJADOR" && existing.trabajadorId === null) {
        this.db
          .prepare(
            `INSERT INTO trabajadores (usuario_id, nombre, telefono, activo)
             VALUES (?, ?, '', ?)`,
          )
          .run(id, existing.nombre, nextActivo ? 1 : 0);
      } else if (existing.trabajadorId !== null) {
        this.db
          .prepare("UPDATE trabajadores SET activo = ? WHERE id = ?")
          .run(
            nextRole === "TRABAJADOR" && nextActivo ? 1 : 0,
            existing.trabajadorId,
          );
      }
      this.db.exec("COMMIT");
      return this.findById(id);
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
}
