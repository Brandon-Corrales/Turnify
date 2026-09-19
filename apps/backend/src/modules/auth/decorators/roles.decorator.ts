import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../../database/entities';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a uno o más roles. Requiere JwtAuthGuard ya aplicado. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
