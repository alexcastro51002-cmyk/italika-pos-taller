import { AppError } from "../../shared/http.js";
import {
  hashPassword,
  signToken,
  verifyPassword,
} from "../../shared/security.js";
import {
  type AuthUser,
  type Permission,
  type UserDTO,
  resolveEffectivePermissions,
} from "../../shared/types.js";
import type { AuthRepository } from "./repo.js";
import type {
  CreateUserInput,
  LoginInput,
  UpdatePermissionsInput,
} from "./schema.js";

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  login(input: LoginInput): LoginResult {
    const row = this.repo.findByEmail(input.email);
    if (!row || !verifyPassword(input.password, row.password_hash)) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Correo o contraseña incorrectos.",
      );
    }
    if (row.activo !== 1) {
      throw new AppError(
        403,
        "USER_INACTIVE",
        "El usuario se encuentra desactivado.",
      );
    }
    const extra = JSON.parse(row.permisos_extra) as Permission[];
    const user: AuthUser = {
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      rol: row.rol,
      permisos: resolveEffectivePermissions(row.rol, extra),
      trabajadorId: row.trabajador_id ?? null,
    };
    const token = signToken(row.id, row.rol);
    return { token, user };
  }

  listUsers(): UserDTO[] {
    return this.repo.listUsers();
  }

  createUser(input: CreateUserInput): UserDTO {
    const existing = this.repo.findByEmail(input.email);
    if (existing) {
      throw new AppError(
        409,
        "EMAIL_EXISTS",
        "Ya existe un usuario con ese correo.",
      );
    }
    return this.repo.createUser({
      nombre: input.nombre,
      email: input.email,
      passwordHash: hashPassword(input.password),
      rol: input.rol,
      permisosExtra: input.permisosExtra,
      telefono: input.telefono,
    });
  }

  updatePermissions(
    actorUserId: number,
    targetUserId: number,
    input: UpdatePermissionsInput,
  ): UserDTO {
    const target = this.repo.findById(targetUserId);
    if (!target) {
      throw new AppError(404, "USER_NOT_FOUND", "Usuario no encontrado.");
    }

    const removesAdminPrivilege =
      target.rol === "ADMIN" &&
      target.activo &&
      ((input.rol !== undefined && input.rol !== "ADMIN") ||
        input.activo === false);

    if (removesAdminPrivilege && this.repo.countActiveAdmins() <= 1) {
      throw new AppError(
        409,
        "LAST_ADMIN_PROTECTED",
        "Debe permanecer al menos un Administrador activo en el sistema.",
      );
    }

    if (actorUserId === targetUserId && input.activo === false) {
      throw new AppError(
        409,
        "SELF_DEACTIVATE_FORBIDDEN",
        "No puedes desactivar tu propia cuenta en sesión.",
      );
    }

    const updated = this.repo.updatePermissions(targetUserId, input);
    if (!updated) {
      throw new AppError(404, "USER_NOT_FOUND", "Usuario no encontrado.");
    }
    return updated;
  }
}
