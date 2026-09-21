import { Request } from 'express';
import { RolUsuario } from '../../../database/entities';

export interface JwtPayload {
  sub: string; // idUsuario
  idNegocio: string;
  rol: RolUsuario;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
