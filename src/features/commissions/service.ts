import { AppError } from "../../shared/http.js";
import type {
  AuthUser,
  CommissionConfigDTO,
  CommissionRuleDTO,
} from "../../shared/types.js";
import type { CommissionsRepository } from "./repo.js";
import type {
  CreateCommissionRuleInput,
  ListCommissionsQuery,
  UpdateCommissionConfigInput,
} from "./schema.js";

export class CommissionsService {
  constructor(private readonly repo: CommissionsRepository) {}

  getConfig(): CommissionConfigDTO {
    return this.repo.getConfig();
  }

  updateConfig(input: UpdateCommissionConfigInput): CommissionConfigDTO {
    return this.repo.updateConfig(input);
  }

  listRules(): CommissionRuleDTO[] {
    return this.repo.listRules();
  }

  createRule(input: CreateCommissionRuleInput): CommissionRuleDTO {
    return this.repo.createRule(input);
  }

  deleteRule(id: number): void {
    const ok = this.repo.deactivateRule(id);
    if (!ok) {
      throw new AppError(
        404,
        "RULE_NOT_FOUND",
        "Regla de comisión no encontrada.",
      );
    }
  }

  listCommissions(actor: AuthUser, query: ListCommissionsQuery) {
    if (actor.permisos.includes("commissions:read_all")) {
      return this.repo.listMovements(query);
    }
    if (actor.rol === "TRABAJADOR") {
      return this.repo.listMovements(query, {
        beneficiaryType: "TRABAJADOR",
        beneficiaryId: actor.trabajadorId,
      });
    }
    return this.repo.listMovements(query, {
      beneficiaryType: "SECRETARIA",
      beneficiaryId: actor.id,
    });
  }
}
