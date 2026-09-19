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
(`WHERE eliminado_en IS NULL`), ver detalle en Decisiones técnicas. También
se roté la contraseña de Supabase y se confirmó que todo sigue conectando
(solo cambia `.env`, cero cambios de código).

- **Backend: Módulo Auth — registro de negocio + login JWT + refresh token
  + guards de rol** ✅
  - `POST /auth/registro`: transacción que crea Negocio + Usuario(admin) +
    Suscripcion(plan gratis) atómicamente; `errorCode: EMAIL_YA_REGISTRADO`
    si el correo del negocio o del admin ya existe.
  - `POST /auth/login`: valida contra `contrasenaHash` (bcryptjs),
    `errorCode: CREDENCIALES_INVALIDAS` sin revelar si el correo existe o
    no; `CUENTA_INACTIVA` si `usuario.activo=false`.
  - `POST /auth/refresh`: rotación de refresh token con detección de
    reuso — si alguien reutiliza un refresh token ya rotado, se revoca la
    sesión completa (`refreshTokenHash = null`), obligando a loguear de
    nuevo.
  - `POST /auth/logout`: invalida el refresh token vigente.
  - `JwtAuthGuard` + `RolesGuard` registrados como `APP_GUARD` globales:
    toda ruta futura requiere JWT válido salvo `@Public()`, y `@Roles(...)`
    restringe por rol cuando se declare. `GET /health` marcado `@Public()`.
  - Política de contraseña: mínimo 8 caracteres, al menos una letra y un
    número (class-validator en el DTO).
  - Columna nueva `usuarios.refresh_token_hash` (migración
    `UsuarioRefreshTokenHash`), aplicada en local y Supabase.
  - **Bug real encontrado y corregido durante las pruebas**: el hash del
    refresh token usaba bcrypt, que trunca su entrada a 72 bytes. Como
    todos los refresh tokens de un mismo usuario comparten un prefijo
    (mismo `sub`/`idNegocio`/`rol`) más largo que eso, `bcrypt.compare()`
    los trataba como idénticos entre sí — la detección de reuso NUNCA
    fallaba, cualquier refresh token viejo seguía siendo aceptado
    indefinidamente. Se cambió a SHA-256 (más `jti` aleatorio para evitar
    colisiones si dos refresh caen en el mismo segundo) — apropiado porque
    un refresh token ya es de alta entropía y no necesita el salteo lento
    de bcrypt, a diferencia de una contraseña. Verificado con una prueba
    manual completa: login → refresh → reuso del token viejo (401,
    correcto) → el sucesor legítimo también queda revocado (correcto,
    respuesta a un reuso detectado) → logout con token válido (204) →
    ruta protegida sin token (401).

- **Backend: Guard/interceptor multi-tenant (filtrar automáticamente por
  id_negocio)** ✅ (`src/common/tenant/`)
  - `TenantContextService`: contexto por request basado en
    `AsyncLocalStorage` (no en un provider request-scoped, para no pagar
    el costo de reconstruir el grafo de DI en cada request). Falla
    cerrado: pedir `idNegocio` fuera de una request autenticada lanza, en
    vez de devolver `undefined`.
  - `TenantContextInterceptor`: puebla ese contexto con
    `{idNegocio, idUsuario, rol}` desde `request.user` (ya puesto por
    `JwtAuthGuard`). Es interceptor y no guard a propósito — necesita
    envolver `next.handle()` completo dentro de `als.run()`, algo que un
    guard no puede hacer. Registrado como `APP_INTERCEPTOR` global en
    `TenantModule` (`@Global()`, igual que los guards de `AuthModule`).
  - `TenantScopedRepository<T>`: envuelve un `Repository<T>` de TypeORM
    inyectando `idNegocio` del tenant actual en `find/findOne/count/
    create/save/update/softDelete` — el caller NO puede omitirlo ni
    sobreescribirlo (el `idNegocio` del contexto siempre gana sobre
    cualquiera que venga en el `where`/entity). Solo cubre entidades con
    columna `idNegocio` propia (Usuario, Cliente, Servicio, Reserva,
    Disponibilidad, Suscripcion); `Notificacion` y
    `ExcepcionDisponibilidad` no tienen `idNegocio` directo y se filtran
    por join dentro del servicio de su propio módulo — fuera del alcance
    de este wrapper genérico.
  - `TenantRepositoryProvider(Entity)` + `@InjectTenantRepository(Entity)`:
    forma de inyectar el repositorio tenant-scoped en un futuro servicio,
    igual de simple que `@InjectRepository`. Ningún módulo de negocio lo
    usa todavía (siguen vacíos) — lo consumirán las tarjetas de CRUD que
    vienen después (Negocios, Usuarios, Clientes, Servicios,
    Disponibilidad, Reservas).
  - Verificado con un script `ts-node` desechable (no con Jest, ver nota
    de ESM abajo): inyecta `idNegocio` con y sin `where` explícito, un
    `idNegocio` ajeno que el caller intente colar SIEMPRE es sobreescrito,
    `create`/`save`/`update`/`softDelete` quedan filtrados, dos contextos
    concurrentes de negocios distintos no se mezclan (aislamiento real
    vía `AsyncLocalStorage`), y usar el repositorio fuera de contexto
    rechaza la promesa en vez de correr sin filtrar.
  - Probado además contra la app real: `GET /health` (pública, sin
    `request.user`) y `POST /auth/logout` (protegida, dispara el
    interceptor) ambas siguen respondiendo correctamente con
    `TenantModule` cargado.

## Decisión pendiente para el equipo — Jest no corre todavía (NestJS 12 es ESM-only)
Al intentar montar Jest para probar `TenantScopedRepository` como test
formal, se encontró que `@nestjs/common@12` (y el resto de paquetes
`@nestjs/*`) se publican como **ESM puro** (`"type": "module"` en su
`package.json`, sin build CommonJS). La app real corre perfecto igual
(`node dist/main.js` funciona) porque Node 22.12+ ya sabe hacer
`require()` de un módulo ESM síncrono de forma nativa — pero el motor de
módulos propio de Jest todavía no soporta ese puente (su propio mensaje
de error dice literalmente "Use Node v24.9+ where Jest supports
require(esm) natively"). Por eso se revirtió el intento de agregar
`jest`/`ts-jest` como dependencias — habría quedado un `npm test` roto en
el repo. La verificación de esta tarjeta se hizo con un script `ts-node`
temporal (borrado al terminar), documentado arriba.

Esto bloquea específicamente la tarjeta **"QA: Tests unitarios de reglas
de negocio críticas"** y hay que decidir un camino antes de esa tarjeta:
1. Migrar el backend completo a ESM (`"type": "module"`, tsconfig
   `NodeNext`, extensiones `.js` en todos los imports relativos, ajustar
   el CLI de TypeORM) — la ruta "correcta" a largo plazo, pero es un
   cambio transversal grande.
2. Agregar un transform de Babel (`babel-jest` + `@babel/preset-env`)
   limitado a `node_modules/@nestjs/**` para convertir su ESM a CommonJS
   solo dentro de Jest, sin tocar el resto del proyecto — más rápido, más
   parche.
3. Esperar/objetivo Node 24.9+ en el entorno de CI/dev del equipo, donde
   Jest ya soporta `require(esm)` nativo sin configuración especial.

No se tomó esta decisión unilateralmente porque cambia cómo se escribe
TODO el código del backend (opción 1) o añade una pieza de tooling nueva
(opción 2) — se necesita alineación del equipo antes del Seguimiento #2.

## Tarea en curso
Ninguna — lista para **"Backend: Módulo Negocios — CRUD + onboarding"**.

## Seguridad
✅ La contraseña de la base de datos de Supabase, compartida en texto
plano en un chat, ya fue rotada por el equipo y se confirmó que
`DATABASE_URL` sigue conectando (cero cambios de código necesarios).

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

```bash
curl -X POST localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"correoElectronico":"admin@turnify.app","contrasena":"Turnify123!"}'
# -> { usuario: {...}, tokens: { accessToken, refreshToken } }
curl -X POST localhost:3000/auth/refresh -H "Content-Type: application/json" \
  -d '{"refreshToken":"<el de arriba>"}'
```

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
- **`@nestjs/jwt` directo, sin Passport**: la guía oficial de NestJS
  documenta ambos caminos; se eligió `JwtService` + un guard propio
  (`JwtAuthGuard`) en vez de `@nestjs/passport` + `passport-jwt` para tener
  menos dependencias transitivas y poder firmar el access y el refresh
  token con secretos y expiraciones distintas en la misma llamada
  (`jwtService.signAsync(payload, { secret, expiresIn })`), algo más
  directo que configurar dos estrategias de Passport.
- **Regla general para cualquier hash futuro de tokens largos (no
  contraseñas)**: usar SHA-256, nunca bcrypt — bcrypt trunca a 72 bytes
  (ver bug de refresh token arriba). bcrypt sigue siendo correcto para
  `contrasena_hash` porque las contraseñas son cortas y sí necesitan el
  salteo lento contra fuerza bruta offline.

## Cómo continuar si se corta la sesión
Ver reglas de commit/pausa en el prompt original de arquitectura (punto 18
del brief del equipo). Resumen: terminar hasta que compile, commitear con
mensaje honesto, actualizar este archivo, nunca reiniciar un módulo con
avance ya commiteado.
