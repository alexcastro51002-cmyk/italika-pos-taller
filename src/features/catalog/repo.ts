import type { DatabaseSync } from "node:sqlite";
import type { ServiceDTO } from "../../shared/types.js";
import type {
  CreateServiceInput,
  ListServicesQuery,
  UpdateServiceInput,
} from "./schema.js";

interface ServiceRow {
  id: number;
  nombre: string;
  descripcion: string;
  precio_base: number;
  duracion_min: number;
  activo: number;
  creado_en: string;
  actualizado_en: string;
}

function mapRow(row: ServiceRow): ServiceDTO {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    precioBase: row.precio_base,
    duracionMin: row.duracion_min,
    activo: row.activo === 1,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

export class CatalogRepository {
  constructor(private readonly db: DatabaseSync) {}

  list(query: ListServicesQuery): ServiceDTO[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (query.active === "true") {
      clauses.push("activo = 1");
    } else if (query.active === "false") {
      clauses.push("activo = 0");
    }

    if (query.q.length > 0) {
      clauses.push(
        "(LOWER(nombre) LIKE LOWER(?) OR LOWER(descripcion) LIKE LOWER(?))",
      );
      const term = `%${query.q}%`;
      params.push(term, term);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM servicios ${where} ORDER BY id ASC`)
      .all(...params) as unknown as ServiceRow[];
    return rows.map(mapRow);
  }

  findById(id: number): ServiceDTO | undefined {
    const row = this.db
      .prepare("SELECT * FROM servicios WHERE id = ?")
      .get(id) as ServiceRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  findByName(nombre: string): ServiceDTO | undefined {
    const row = this.db
      .prepare("SELECT * FROM servicios WHERE LOWER(nombre) = LOWER(?)")
      .get(nombre) as ServiceRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  create(input: CreateServiceInput): ServiceDTO {
    const res = this.db
      .prepare(
        `INSERT INTO servicios (nombre, descripcion, precio_base, duracion_min, activo)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.nombre,
        input.descripcion,
        input.precioBase,
        input.duracionMin,
        input.activo ? 1 : 0,
      );
    const created = this.findById(Number(res.lastInsertRowid));
    if (!created) {
      throw new Error("No se pudo recuperar el servicio creado.");
    }
    return created;
  }

  update(id: number, input: UpdateServiceInput): ServiceDTO | undefined {
    this.db
      .prepare(
        `UPDATE servicios
         SET nombre = ?, descripcion = ?, precio_base = ?, duracion_min = ?, actualizado_en = datetime('now')
         WHERE id = ?`,
      )
      .run(
        input.nombre,
        input.descripcion,
        input.precioBase,
        input.duracionMin,
        id,
      );
    return this.findById(id);
  }

  setActive(id: number, activo: boolean): ServiceDTO | undefined {
    this.db
      .prepare(
        `UPDATE servicios
         SET activo = ?, actualizado_en = datetime('now')
         WHERE id = ?`,
      )
      .run(activo ? 1 : 0, id);
    return this.findById(id);
  }
}
