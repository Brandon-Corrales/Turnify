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
- Categoría **Base de Datos** completa (6/6 tarjetas, ver detalle abajo).
- **Backend: Setup del proyecto NestJS + estructura de módulos** ✅
  - `main.ts`: bootstrap, CORS desde env, `ValidationPipe` global
    (whitelist + transform + `exceptionFactory` propio), filtro global de
    excepciones, Swagger en `/docs`.
  - `app.module.ts`: `ConfigModule` con validación Zod al arrancar
    (`src/config/env.schema.ts`), `TypeOrmModule.forRootAsync` reusando las
    mismas entidades del data-source de TypeORM CLI.
  - Filtro global de errores (`src/common/errors/all-exceptions.filter.ts`)
    ya deja lista la forma estándar `{ statusCode, errorCode, message,
    field? }` del punto 7 del brief — antes de que exista ningún módulo de
    negocio con errores propios.
  - `GET /health` con chequeo real de conexión a la base de datos.
  - Módulos vacíos ya registrados en `AppModule` para que cada tarjeta
    siguiente solo tenga que rellenarlos: `auth`, `negocios`, `usuarios`,
    `clientes`, `servicios`, `disponibilidad`, `reservas` (en
    `src/modules/*`). Notificaciones/Suscripciones/Reportes no se crearon
    todavía — son tarjetas de después del Seguimiento #2.
  - Probado de verdad: `nest build` sin errores, servidor arrancado con
    Postgres local real, `GET /health` → `200 {"status":"ok","database":"up"}`,
    `GET /docs` → 200 (Swagger), ruta inexistente → `404` con el shape de
    error estándar.

Después de esto, un ajuste pedido por el equipo: los índices únicos de
correo en `negocios`/`usuarios`/`clientes` pasaron a ser parciales
(`WHERE eliminado_en IS NULL`), ver detalle en Decisiones técnicas.

## Tarea en curso
Ninguna — lista para **"Backend: Módulo Auth — registro de negocio + login
JWT + refresh token + guards de rol"**.

## Pendiente de seguridad — acción del equipo
La contraseña de la base de datos de Supabase se compartió en texto plano
en un chat. Funciona bien para desarrollo, pero como buena práctica
alguien del equipo debería rotarla desde el dashboard de Supabase
(Project Settings → Database → Reset database password) cuando sea
conveniente, y actualizar el `.env` local de cada quien con la nueva.

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
- **Supabase real ya conectado** (proyecto del equipo, pooler
  `aws-0-us-east-1.pooler.supabase.com`): `DATABASE_URL` en el `.env` local
  (nunca commiteado) apunta ahí y tiene prioridad sobre las variables
  sueltas de Postgres local. Se agregó `ssl: { rejectUnauthorized: false }`
  en `data-source.ts` y en `app.module.ts` cuando hay `DATABASE_URL` — el
  pooler de Supabase exige TLS y su cadena de certificados no siempre
  valida limpio contra el store por defecto de Node (patrón documentado
  por Supabase para node-postgres). Migraciones y seed ya corridos ahí
  también; docker-compose sigue siendo el default para desarrollo sin
  tocar el recurso compartido.
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
- **Resuelto — índices únicos de correo ahora son parciales** (migración
  `PartialUniqueEmailIndexes`): `negocios.correo_electronico`,
  `usuarios.correo_electronico` y `(clientes.id_negocio,
  clientes.correo_electronico)` solo aplican `WHERE eliminado_en IS NULL`.
  Un correo de una cuenta soft-deleted ya se puede reutilizar en un
  registro nuevo. Probado con un INSERT/ROLLBACK manual contra Postgres
  local. Aplicada tanto en local como en el Supabase real del equipo.

- **NestJS 12, no 10**: se verificó en npm (`npm view @nestjs/core dist-tags`)
  que 10.x ya es la etiqueta `old` y 12.x es `latest` a esta fecha — no se
  asumió de memoria. `@nestjs/platform-express@12` trae Express 5 y multer
  2.4 (arregla las vulnerabilidades altas de multer que traía la línea 10).
  `npm audit` en 0 vulnerabilidades después del bump.
- **Un solo `.env` en la raíz del monorepo**, no uno por app: tanto
  `apps/backend/src/database/data-source.ts` (CLI de TypeORM) como
  `app.module.ts` (`ConfigModule.forRoot({ envFilePath: ... })`) apuntan
  explícitamente al `.env` de la raíz, para no mantener dos copias de las
  mismas credenciales de Postgres. El README ya quedó actualizado con este
  flujo.
- **`@nestjs/cli` bajo Node 22.17 tira un warning EBADENGINE** (pide
  22.22+ para los schematics de `@angular-devkit/schematics`, usados por
  `nest generate`). No bloquea `nest build`/`start`, que es lo único usado
  hasta ahora. Si el equipo usa `nest generate` y falla, actualizar Node.

## Cómo continuar si se corta la sesión
Ver reglas de commit/pausa en el prompt original de arquitectura (punto 18
del brief del equipo). Resumen: terminar hasta que compile, commitear con
mensaje honesto, actualizar este archivo, nunca reiniciar un módulo con
avance ya commiteado.
