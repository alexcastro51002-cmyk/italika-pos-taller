import { AppError } from "../../shared/http.js";
import type { ServiceDTO } from "../../shared/types.js";
import type { CatalogRepository } from "./repo.js";
import type {
  CreateServiceInput,
  ListServicesQuery,
  UpdateServiceInput,
} from "./schema.js";

export class CatalogService {
  constructor(private readonly repo: CatalogRepository) {}

  list(query: ListServicesQuery): ServiceDTO[] {
    return this.repo.list(query);
  }

  create(input: CreateServiceInput): ServiceDTO {
    const duplicate = this.repo.findByName(input.nombre);
    if (duplicate) {
      throw new AppError(
        409,
        "SERVICE_EXISTS",
        "Ya existe un servicio registrado con ese nombre.",
      );
    }
    return this.repo.create(input);
  }

  update(id: number, input: UpdateServiceInput): ServiceDTO {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new AppError(404, "SERVICE_NOT_FOUND", "Servicio no encontrado.");
    }
    const byName = this.repo.findByName(input.nombre);
    if (byName && byName.id !== id) {
      throw new AppError(
        409,
        "SERVICE_EXISTS",
        "Ya existe otro servicio con ese nombre.",
      );
    }
    const updated = this.repo.update(id, input);
    if (!updated) {
      throw new AppError(404, "SERVICE_NOT_FOUND", "Servicio no encontrado.");
    }
    return updated;
  }

  setStatus(id: number, activo: boolean): ServiceDTO {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new AppError(404, "SERVICE_NOT_FOUND", "Servicio no encontrado.");
    }
    const updated = this.repo.setActive(id, activo);
    if (!updated) {
      throw new AppError(404, "SERVICE_NOT_FOUND", "Servicio no encontrado.");
    }
    return updated;
  }
}
