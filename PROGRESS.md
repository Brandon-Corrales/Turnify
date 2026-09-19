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
  - Verificado primero con un script `ts-node` desechable, y después
    migrado a un test formal real (ver resolución de Jest/Vitest abajo):
    `src/common/tenant/tenant-scoped.repository.spec.ts`, 8 casos —
    inyecta `idNegocio` con y sin `where` explícito, un `idNegocio` ajeno
    que el caller intente colar SIEMPRE es sobreescrito,
    `create`/`save`/`update`/`softDelete` quedan filtrados, dos contextos
    concurrentes de negocios distintos no se mezclan (aislamiento real vía
    `AsyncLocalStorage`), y usar el repositorio fuera de contexto rechaza
    la promesa en vez de correr sin filtrar.
  - Probado además contra la app real: `GET /health` (pública, sin
    `request.user`) y `POST /auth/logout` (protegida, dispara el
    interceptor) ambas siguen respondiendo correctamente con
    `TenantModule` cargado.

## Resuelto — Jest reemplazado por Vitest (decisión del equipo)
El bloqueo de la sección anterior (NestJS 12 es ESM-only, Jest no sabe
`require(esm)` hasta Node 24.9+) se resolvió con la opción correcta según
la documentación oficial de NestJS: **usar Vitest en vez de Jest como test
runner**, sin tocar el resto del código de la app. Vitest corre sobre
Vite, que maneja ESM de forma nativa, así que el conflicto desaparece sin
migrar el backend a ESM ni parchear Jest con Babel.

- `vitest.config.mts` (extensión `.mts` a propósito: evita el warning de
  Vite por sintaxis ESM en un archivo cargado como CommonJS).
- `unplugin-swc` + `.swcrc` (`decoratorMetadata: true`) reemplazan el
  transform TS por defecto de Vitest (esbuild, que NO implementa
  `emitDecoratorMetadata`) — necesario para que `@nestjs/testing` y la
  inyección de dependencias de Nest funcionen en tests futuros igual que
  con `tsc`. Se agregó `@nestjs/testing` como devDependency ya, aunque
  ningún test lo use todavía.
- `npm test` (`vitest run`) y `npm run test:watch` (`vitest`) en
  `apps/backend/package.json`.
- El test de `TenantScopedRepository` (8 casos, ver arriba) corre y pasa
  con este setup. `nest build` se volvió a probar después del cambio y
  sigue sin errores — Vitest es una dependencia de desarrollo aislada, no
  toca el build de producción ni el CLI de TypeORM.
- Esto desbloquea **"QA: Tests unitarios de reglas de negocio críticas"**
  sin decisiones pendientes: cualquier módulo nuevo ya puede traer sus
  `*.spec.ts` desde el primer commit.

- **Backend: Módulo Negocios — CRUD + onboarding** ✅
  - El "onboarding" (crear Negocio + Usuario admin + Suscripción gratis)
    ya vive en `POST /auth/registro` — este módulo es la gestión del
    perfil propio después de ese alta: `GET /negocios/mi-negocio`
    (cualquier rol), `PATCH /negocios/mi-negocio` y
    `DELETE /negocios/mi-negocio` (ambas solo ADMIN vía `@Roles`).
  - No hay `GET /negocios` (listar todos): el sistema no tiene un rol
    superadmin de plataforma en el ER, cada usuario solo puede ver/editar
    su propio negocio — un "listado" no tendría sentido aquí.
  - `DELETE` = desactivación (soft delete + `estado: 'inactivo'`), nunca
    borrado físico, según punto 1 del brief. Tras desactivar, el propio
    negocio devuelve `404 NEGOCIO_NO_ENCONTRADO` en vez de sus datos (el
    JWT sigue siendo válido porque es stateless — bloquear el acceso de
    verdad por negocio desactivado/suspendido es trabajo del futuro guard
    de límites de plan freemium, no de este módulo).
  - **Excepción documentada al `TenantScopedRepository`**: `Negocio` es la
    raíz del tenant (su propia PK es el id de tenant), no una entidad hija
    con columna `idNegocio` — así que este servicio filtra manualmente por
    `{ idNegocio: tenantContext.idNegocio }` en vez de usar el wrapper
    genérico (que exige esa columna por diseño).
  - Tests: `negocios.service.spec.ts` (5 casos) — cada operación queda
    scoped al tenant actual, `NEGOCIO_NO_ENCONTRADO` si no existe, y falla
    cerrado sin contexto de tenant.
  - Probado además contra la app real: registro → `GET`/`PATCH` con token
    (200, cambio persistido) → sin token (401) → `DELETE` (204) → `GET`
    posterior (404, confirma la desactivación).

- **Backend: Módulo Usuarios — CRUD + roles admin/empleado** ✅
  - `POST /usuarios` (crear empleado/admin), `GET /usuarios` (paginado),
    `GET /usuarios/:id`, `PATCH /usuarios/:id`, `DELETE /usuarios/:id`
    (desactivar). Crear/editar/desactivar son solo ADMIN vía `@Roles`;
    listar/ver son de cualquier rol autenticado del negocio.
  - **Primer consumidor real de `TenantScopedRepository` /
    `TenantRepositoryProvider`** (las tarjetas de DB y del guard
    multi-tenant dejaron el mecanismo listo, este módulo es el que
    finalmente lo usa) — el servicio nunca menciona `idNegocio`
    explícitamente, todo el filtrado por tenant queda delegado al wrapper.
  - **Regla de negocio nueva, no pedida literal pero necesaria por
    integridad de datos**: no se puede desactivar ni degradar de rol al
    último ADMIN activo de un negocio (`errorCode: ULTIMO_ADMIN_REQUERIDO`)
    — evitaría dejar un negocio sin nadie que lo administre.
  - Al desactivar un usuario también se limpia su `refresh_token_hash`
    (mismo criterio que logout), para que no pueda seguir renovando su
    sesión aunque su access token de corta duración no haya expirado
    todavía.
  - `TenantScopedRepository` ganó `findAndCount()` (find+count en una sola
    llamada, ya con `idNegocio` inyectado) para soportar el listado
    paginado — reutilizable por Clientes/Servicios/Reservas más adelante.
  - Se extrajo `EsContrasenaValida()` (`common/validation/`) para no
    repetir la regex/mensaje de política de contraseña entre
    `RegistroNegocioDto` y `CrearUsuarioDto`.
  - Se creó `PaginationQueryDto`/`PaginatedResult<T>`
    (`common/pagination/`) como el mecanismo compartido de paginación que
    pide el punto 3 del brief para todo endpoint de listado — primer uso
    aquí, listo para reusar en Clientes/Servicios/Reservas.
  - Tests: `usuarios.service.spec.ts` (9 casos) — hash de contraseña,
    `EMAIL_YA_REGISTRADO`, paginación, `USUARIO_NO_ENCONTRADO`, permitir
    degradar un admin si hay otro admin activo, bloquear degradar/desactivar
    al último admin, y que desactivar limpia el refresh token.
  - Probado además contra la app real: crear empleado → listar (paginado,
    sin `contrasenaHash` filtrado) → bloquear desactivar al único admin
    (409) → desactivar empleado (204) → `GET` posterior (404) → correo
    duplicado (409) → id no-UUID (400, no 500) → un `empleado` recibe 403
    al intentar crear usuarios pero sí puede listarlos (200).

- **Backend: Módulo Clientes — CRUD** ✅
  - `POST/GET/GET:id/PATCH/DELETE /clientes`, paginado con
    `PaginationQueryDto`/`PaginatedResult<T>` (ya creados en la tarjeta de
    Usuarios). `DELETE` = desactivar (soft delete + `activo:false`).
  - **Sin `@Roles`**: a diferencia de Usuarios, gestionar clientes es
    trabajo operativo del día a día (recepción), no una acción
    administrativa — cualquier rol autenticado del negocio puede crear,
    ver, editar o desactivar clientes.
  - Correo duplicado dentro del mismo negocio →
    `errorCode: CLIENTE_CORREO_YA_REGISTRADO` (409), tanto al crear como
    al editar el correo de un cliente existente.
  - `nivelCliente` (gratis/premium) y `canalPreferido` (email/whatsapp) ya
    se pueden leer/escribir desde este CRUD — la restricción real de
    WhatsApp según el plan del negocio y el techo del punto 4.2 (un
    cliente premium nunca desbloquea un canal que el negocio no tiene) son
    trabajo de los guards de freemium, tarjetas de después del
    Seguimiento #2. Este módulo solo persiste el dato.
  - Tests: `clientes.service.spec.ts` (8 casos).
  - Probado además contra la app real: crear → correo duplicado (409) →
    listar paginado → `PATCH` → `DELETE` (204) → `GET` posterior (404).
  - **Nota de metodología de prueba, no un bug de código**: probar manualmente
    con acentos (`María`) tecleados directo en un `curl -d` de Git Bash en
    Windows corrompía los bytes antes de salir del cliente (problema de
    code page de la consola, no de Turnify). Se confirmó con un cliente
    HTTP en Node y una lectura de bytes crudos en Postgres
    (`encode(campo::bytea,'hex')`) que el pipeline HTTP → NestJS → Postgres
    guarda UTF-8 perfectamente. Para pruebas manuales futuras con acentos
    en esta máquina, usar un script Node/Postman en vez de escribir tildes
    directo en el argumento de `curl` en Git Bash.

- **Backend: Módulo Servicios — CRUD (nombre, duración, precio)** ✅
  - `POST/GET/GET:id/PATCH/DELETE /servicios`, mismo patrón que Clientes
    (sin `@Roles`, paginado, `DELETE` = desactivar).
  - `precio` es `numeric(10,2)` en Postgres → TypeORM lo expone como
    `string` en la entidad. El DTO acepta un `number` (más natural para
    la API/Swagger) y el servicio lo convierte con `.toFixed(2)` antes de
    guardar — probado que conserva decimales exactos (`7999.5` →
    `"7999.50"`, no se trunca ni redondea de más).
  - `duracionMinutos`: entero, mínimo 1, máximo 1440 (un día) como tope de
    cordura contra errores de captura — no es un límite pedido
    literalmente por el brief, es solo para bloquear datos absurdos.
  - `colorCalendario`: valida formato hex (`#rgb` o `#rrggbb`) con
    `@Matches`, porque lo va a consumir directo FullCalendar en el
    frontend — mejor rechazarlo aquí que romper el render del calendario
    después.
  - Límite freemium "máximo 3 servicios activos" (punto 4.1) NO se
    enforce en este módulo — es trabajo del guard de límites de plan,
    tarjeta de después del Seguimiento #2.
  - Tests: `servicios.service.spec.ts` (8 casos), incluyendo la
    conversión numérica de `precio` en ambas direcciones (crear/actualizar)
    y que actualizar sin `precio` no toca esa columna.
  - Probado además contra la app real: crear → color hex inválido (400,
    `field: colorCalendario`) → duración `0` (400) → precio negativo (400)
    → listar paginado → `PATCH` precio con decimales → `DELETE` (204) →
    `GET` posterior (404).

- **Backend: Módulo Disponibilidad — CRUD + validación de traslapes de
  horario** ✅
  - `POST/GET/GET:id/PATCH/DELETE /disponibilidad`. `GET` acepta
    `?idUsuario=` para filtrar. Sin paginación a propósito: la
    disponibilidad de un usuario son a lo sumo unas pocas decenas de
    franjas, no una lista que crezca sin límite como clientes/reservas —
    el punto 3 del brief pide paginación para listas grandes, esta no lo
    es.
  - **Autorización por objetivo, no por rol fijo del endpoint**: un
    `empleado` solo puede crear/editar/desactivar SU PROPIO horario; un
    `admin` puede gestionar el de cualquier usuario del negocio
    (`errorCode: DISPONIBILIDAD_AJENA` si un empleado intenta tocar el de
    otro). Por eso el controller no usa `@Roles` — la decisión depende del
    `idUsuario` del body/registro, no puede resolverse antes de leer el
    payload.
  - **Validación de traslapes** (la que da nombre a la tarjeta): dos
    franjas del mismo usuario y mismo `diaSemana` se traslapan si
    `existente.horaInicio < nueva.horaFin` Y `existente.horaFin >
    nueva.horaInicio` — implementado con `LessThan`/`MoreThan` de TypeORM
    para que la comparación de horas la haga Postgres (tipo `time`), no
    JS. Al editar, el propio registro se excluye del chequeo (`Not(id)`).
    Casos límite probados: un horario justo a continuación de otro
    (`12:00` empieza cuando el anterior termina) NO se considera traslape
    — intervalos semiabiertos `[inicio, fin)`, igual que uno esperaría de
    Google Calendar.
  - Valida que `horaFin > horaInicio` y que el `idUsuario` exista dentro
    del negocio actual antes de aceptar la franja.
  - Sin soft delete propio (el ER no le da `eliminado_en` a esta tabla):
    `DELETE` solo pone `activo:false`, consistente con el diseño de la
    entidad.
  - Tests: `disponibilidad.service.spec.ts` (11 casos) — autorización
    empleado/admin en ambas direcciones, rango inválido, usuario
    inexistente, traslape detectado y traslape evitado, exclusión del
    propio registro al editar.
  - Probado además contra la app real: empleado crea su propio horario →
    empleado intenta crear el del admin (403) → admin crea uno traslapado
    para el empleado (409) → admin crea uno consecutivo sin traslape
    (201) → rango inválido (400) → listado filtrado por usuario.

- **Backend: Módulo Reservas — crear/cancelar/reprogramar + validación de
  choques de horario** ✅ — la tarjeta más sensible de todo el Seguimiento
  #2. Endpoints: `POST /reservas`, `GET /reservas` (paginado, filtros
  `idUsuario`/`idCliente`/`estado`/`desde`/`hasta` — estos dos últimos
  pensados para que el futuro Calendario de FullCalendar pida solo el
  rango visible), `GET /reservas/:id`, `PATCH /reservas/:id/cancelar`,
  `PATCH /reservas/:id/reprogramar`. Sin `DELETE`: una reserva nunca se
  borra físicamente, es exactamente el historial que justifica el
  soft-delete del resto de entidades — "cancelar" es la única baja.
  - **Defensa en dos capas contra el doble-booking bajo concurrencia**
    (punto 3 del brief, literal):
    1. Aplicación: dentro de una transacción, `SELECT
       pg_advisory_xact_lock(hashtext(idUsuario))` serializa cualquier
       intento concurrente de reservar al MISMO usuario — la segunda
       request espera a que la primera termine su transacción antes de
       poder siquiera consultar traslapes.
    2. Base de datos: migración `ReservaSinTraslapeExclusionConstraint`
       agrega `CREATE EXTENSION btree_gist` + un `EXCLUDE USING gist
       (id_usuario WITH =, tstzrange(fecha_hora_inicio, fecha_hora_fin)
       WITH &&) WHERE (estado <> 'cancelada')` sobre `reservas` — Postgres
       rechaza el INSERT/UPDATE aunque el candado de la app fallara por
       cualquier motivo. El código atrapa el SQLSTATE `23P01`
       (exclusion_violation, confirmado empíricamente contra el driver
       `pg`) y lo traduce al mismo `errorCode: RESERVA_TRASLAPADA`.
    3. **Verificado de verdad, no solo en teoría**: se dispararon dos
       `POST /reservas` genuinamente simultáneos (mismo usuario, mismo
       horario) contra el servidor real — exactamente uno devolvió `201`
       y el otro `409 RESERVA_TRASLAPADA`, y se confirmó con una consulta
       directa a Postgres que solo quedó una fila para ese horario.
  - **Choque de horario** = dos reservas del mismo usuario con
    `[fechaHoraInicio, fechaHoraFin)` solapados, excluyendo canceladas —
    mismo patrón `LessThan`/`MoreThan` que Disponibilidad, ahora sobre
    columnas `timestamptz`.
  - `fechaHoraFin` se calcula en el servidor (`fechaHoraInicio +
    servicio.duracionMinutos`), nunca la manda el cliente — evita
    inconsistencias entre lo que cobra el servicio y lo que ocupa la
    agenda.
  - **Nueva validación que conecta con la tarjeta anterior**: una reserva
    también debe caer dentro de una franja activa de `DISPONIBILIDAD` del
    usuario para ese día/hora (`errorCode: FUERA_DE_DISPONIBILIDAD`) — si
    no, el módulo de Disponibilidad que acabamos de construir no tendría
    ningún efecto real sobre las reservas.
  - **Decisión técnica importante — zona horaria fija Costa Rica
    (UTC-6)**: el ER no tiene un campo de zona horaria por negocio, y el
    mercado objetivo es Costa Rica (que no observa horario de verano), así
    que `common/utils/zona-horaria-negocio.ts` usa un offset fijo de -6h
    para traducir un `timestamptz` a día-de-semana/hora local antes de
    compararlo contra `DISPONIBILIDAD`. Si el producto llega a soportar
    negocios fuera de Costa Rica, esto debe volverse un campo configurable
    por `NEGOCIO`, no una constante — dejar anotado para no repetir este
    error de diseño más adelante.
  - Rechaza reservar/reprogramar a una fecha ya pasada
    (`FECHA_EN_EL_PASADO`), reprogramar una reserva ya cancelada
    (`RESERVA_CANCELADA`), cancelar dos veces
    (`RESERVA_YA_CANCELADA`), y una reserva que cruzaría la medianoche en
    hora de Costa Rica (`RESERVA_CRUZA_MEDIANOCHE` — una franja de
    disponibilidad es de un solo día, cruzar medianoche no tiene forma de
    validarse contra ella).
  - Alcance explícitamente fuera de esta tarjeta: el endpoint público sin
    autenticar para el wizard de reserva de 4 pasos es una tarjeta de
    frontend de después del Seguimiento #2 y necesitará su propio
    endpoint — este módulo es para el calendario interno autenticado del
    staff.
  - Tests: `reservas.service.spec.ts` (11 casos) — cálculo de
    `fechaHoraFin`, adquisición del advisory lock, validaciones de
    existencia, fecha pasada, fuera de disponibilidad, traslape proactivo,
    traducción del `23P01`, y las transiciones de cancelar/reprogramar.
  - Probado además contra la app real, incluyendo la prueba de
    concurrencia real descrita arriba, reprogramar hacia un choque (409) y
    hacia un horario libre (200), y el filtro `desde`/`hasta` para el
    calendario.

## Tarea en curso
Con esto, **todas las tarjetas de Backend priorizadas para el Seguimiento
#2 están cerradas** (Setup, Auth, guard multi-tenant, y los módulos de
Negocios/Usuarios/Clientes/Servicios/Disponibilidad/Reservas). Lo que
sigue según el orden del punto 17 es **Frontend**, empezando por
**"Frontend: Setup Vite + TypeScript + Tailwind + estructura de
carpetas"**.

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
