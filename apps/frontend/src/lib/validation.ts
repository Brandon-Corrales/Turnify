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

export const datosClientePublicoSchema = z.object({
  nombreCompleto: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  correoElectronico: z.string().min(1, 'El correo es obligatorio').email('Correo inválido'),
  telefono: z.string().max(30).optional().or(z.literal('')),
});

export type DatosClientePublicoFormValues = z.infer<typeof datosClientePublicoSchema>;

export const clienteSchema = z.object({
  nombreCompleto: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  correoElectronico: z.string().min(1, 'El correo es obligatorio').email('Correo inválido'),
  telefono: z.string().max(30).optional().or(z.literal('')),
  notas: z.string().max(500).optional().or(z.literal('')),
  canalPreferido: z.enum(['email', 'whatsapp']),
  idiomaPreferido: z.enum(['es', 'en']),
  nivelCliente: z.enum(['gratis', 'premium']),
});

export type ClienteFormValues = z.infer<typeof clienteSchema>;

export const servicioSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  // Mismos límites que CrearServicioDto en el backend (IsInt, Min(1), Max(1440)).
  // Sin z.coerce: el input usa registro con {valueAsNumber: true} (RHF ya
  // entrega number), así el tipo de entrada/salida del resolver coincide y
  // useForm<ServicioFormValues> no choca con TFieldValues (ver ServiciosPage).
  duracionMinutos: z.number('Ingresa un número').int().min(1, 'Mínimo 1 minuto').max(1440),
  // IsPositive() en el backend — un servicio no puede costar 0.
  precio: z.number('Ingresa un número').positive('Debe ser mayor a 0'),
  colorCalendario: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color hex inválido (#rrggbb)')
    .optional()
    .or(z.literal('')),
});

export type ServicioFormValues = z.infer<typeof servicioSchema>;
