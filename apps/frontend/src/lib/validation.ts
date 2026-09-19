import { z } from 'zod';
import { TIPOS_NEGOCIO } from './tipo-negocio';

/**
 * Misma política que EsContrasenaValida() en el backend (apps/backend/src/
 * common/validation/es-contrasena-valida.decorator.ts): 8+ caracteres, al
 * menos una letra y un número. No es código compartido literal (no hay un
 * paquete común entre frontend/backend todavía), pero es la MISMA regla de
 * negocio escrita dos veces a propósito — el backend manda como fuente de
 * verdad final, esto es solo para feedback instantáneo en el formulario
 * (punto 13 del brief: validar en ambos lados sin duplicar la fuente de
 * verdad de las reglas de negocio).
 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const MENSAJE_CONTRASENA = 'La contraseña debe tener al menos 8 caracteres, una letra y un número';

export const contrasenaSchema = z
  .string()
  .min(8, MENSAJE_CONTRASENA)
  .regex(PASSWORD_REGEX, MENSAJE_CONTRASENA);

export const loginSchema = z.object({
  correoElectronico: z.string().min(1, 'El correo es obligatorio').email('Correo inválido'),
  contrasena: z.string().min(1, 'La contraseña es obligatoria'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registroSchema = z.object({
  nombreNegocio: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  tipoNegocio: z.enum(TIPOS_NEGOCIO, 'Selecciona un tipo de negocio'),
  correoNegocio: z.string().min(1, 'El correo es obligatorio').email('Correo inválido'),
  telefonoNegocio: z.string().max(30).optional().or(z.literal('')),
  nombreCompletoAdmin: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  correoAdmin: z.string().min(1, 'El correo es obligatorio').email('Correo inválido'),
  contrasena: contrasenaSchema,
});

export type RegistroFormValues = z.infer<typeof registroSchema>;
