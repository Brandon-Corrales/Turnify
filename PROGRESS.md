# Progreso — Turnify

> Antes de tocar código, lee este archivo completo y corre `git log --oneline -10`
> para confirmar el estado real del repo. No repitas tareas ya cerradas aquí.

## Seguimiento #2 — 2026-09-24
Prioridad hasta esa fecha: flujo de reserva básico funcionando end-to-end
(DB → Auth → Negocios/Usuarios/Clientes/Servicios/Disponibilidad/Reservas →
Calendario en frontend). Freemium, chatbot, notificaciones, pagos, dark
mode, i18n completo y responsive quedan para DESPUÉS — no adelantar esas
tareas a costa del flujo mínimo.

## Última tarea completada
Categoría **Base de Datos** completa (6/6 tarjetas):
- DB: Ajustar diagrama ER final (evaluar tabla EXCEPCION_DISPONIBILIDAD)
- DB: Configurar PostgreSQL en Supabase + variables de entorno
- DB: Migraciones iniciales (TypeORM/Prisma) de las 8 entidades del ER
- DB: Índices y constraints (email único, FK con cascada en reservas)
- DB: Seed de datos de prueba (negocio demo, servicios, usuarios, clientes)
- DB: Definir límites de plan freemium (gratis vs pago) en configuración del sistema

## Tarea en curso
Ninguna — lista para arrancar la siguiente categoría (Backend), empezando
por **"Backend: Setup del proyecto NestJS + estructura de módulos"**.

## Cómo probar lo que ya existe
```bash
docker compose up -d              # Postgres local
cp .env.example .env              # (ya existe en este checkout de dev)
cd apps/backend
npm install
npm run migration:run             # crea las 9 tablas
npm run seed                      # negocio + admin + servicios + clientes demo
```
Admin demo: `admin@turnify.app` / `Turnify123!` (negocio "Barbería Demo Turnify").

## Decisiones técnicas tomadas
- **TypeORM sobre Prisma**: ya era la decisión del equipo (ver README). Se
  confirma porque el patrón de guard/interceptor multi-tenant e
  interceptores de soft-delete encajan mejor con el Repository pattern de
  TypeORM + decoradores, que es el estilo nativo de NestJS.
- **EXCEPCION_DISPONIBILIDAD se mantiene** como tabla separada de
  DISPONIBILIDAD: DISPONIBILIDAD son reglas semanales recurrentes,
  EXCEPCION_DISPONIBILIDAD son bloqueos puntuales por fecha (vacaciones,
  incapacidades). Cardinalidad y ciclo de vida distintos → no conviene
  fusionarlas.
- **9 entidades, no 8**: el ER lista 8 en el título de la tarjeta pero el
  cuerpo del punto 1 describe 9 tablas (incluye SUSCRIPCION). Se
  implementaron las 9.
- **Postgres local vía docker-compose para desarrollo**, en vez de crear ya
  el proyecto real en Supabase: la creación del proyecto Supabase requiere
  la cuenta/credenciales del equipo. `DATABASE_URL` en `.env` tiene
  prioridad sobre las variables sueltas — para pasar a Supabase en
  producción solo hay que setear esa variable con la connection string que
  entregue el dashboard de Supabase, sin tocar código.
- **bcryptjs en vez de bcrypt**: `bcrypt` trae `@mapbox/node-pre-gyp` →
  `tar` con una vulnerabilidad crítica activa (ver advisories GHSA-34x7-*,
  entre otros) y requiere toolchain nativo para compilar en Windows.
  `bcryptjs` es JS puro, mismo formato de hash, `npm audit` queda en 0
  vulnerabilidades.
- **Soft delete vía `@DeleteDateColumn` (`eliminado_en`)** en Negocio,
  Usuario, Cliente, Servicio — usa el soporte nativo de TypeORM
  (`softDelete`/`restore`/`withDeleted`) en vez de un campo booleano manual.
- **FKs de RESERVA en `ON DELETE CASCADE`**: el camino normal de borrado
  de negocio/usuario/cliente/servicio es soft-delete (no dispara cascada
  real), así que esto es una red de seguridad para un borrado físico real
  (ej. purga tipo GDPR de un negocio), no el flujo habitual.
- **Límite conocido, pendiente de confirmar con el equipo**: el índice
  único de `correo_electronico` en `negocios` y `usuarios` no es parcial
  (no excluye `eliminado_en IS NOT NULL`), así que un correo de un negocio
  o usuario soft-deleted no se puede reutilizar todavía. Si el equipo lo
  necesita, se resuelve con un índice único parcial en una migración
  posterior.

## Cómo continuar si se corta la sesión
Ver reglas de commit/pausa en el prompt original de arquitectura (punto 18
del brief del equipo). Resumen: terminar hasta que compile, commitear con
mensaje honesto, actualizar este archivo, nunca reiniciar un módulo con
avance ya commiteado.
