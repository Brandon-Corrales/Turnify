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

Con las tarjetas de Backend del Seguimiento #2 cerradas, se agregó
además (no era su propia tarjeta, pero cerraba un vacío del punto 13 del
brief) **ESLint + Prettier en el backend** — nunca los había tenido desde
el primer commit como pide el brief. Ver detalle en el commit
`chore: agregar ESLint + Prettier en backend...`.

- **Frontend: Setup Vite + TypeScript + Tailwind + estructura de
  carpetas** ✅
  - Versiones verificadas en npm, no de memoria (React 19.3, Vite 8.3,
    Tailwind 4.3 — CSS-first config, ESLint 10, TanStack Query 5.103,
    React Router 7.18). **TypeScript se fijó en 5.9.3, NO en la 7.0.2 que
    marca "latest"**: `typescript-eslint`, la pieza que integra ESLint
    con TS, declara como peer dependency `typescript: '>=4.8.4 <6.1.0'` —
    TS7 (el compilador nativo reescrito en Go) todavía no es compatible
    con esa cadena de herramientas. Confirmado con
    `npm view typescript-eslint peerDependencies` antes de decidir, no
    asumido.
  - Estructura exacta del punto 16 del brief:
    `components/{ui,forms,layout}/`, `pages/`, `i18n/locales/` (todas
    vacías por ahora, con `.gitkeep` — las llena cada tarjeta específica
    que corresponda, empezando por "Frontend: Set de componentes UI
    compartidos"). Además `lib/` (cliente de TanStack Query) y `assets/`,
    convenciones estándar de Vite no listadas explícitamente en el brief
    pero de bajo riesgo y ya esperadas por la comunidad React.
  - **Tailwind v4 usa configuración CSS-first** (`@theme` en
    `src/index.css`), no `tailwind.config.js` — cambio real de la
    herramienta entre v3 y v4, verificado antes de escribir el setup.
    Design tokens del punto 6: paleta `primary`/`secondary` (escalas
    50-900) y `success`/`warning`/`danger`/`info` para el futuro
    Toast/Alert de 4 variantes (punto 7), más radios de borde
    (`--radius-sm/md/lg/xl`).
  - **Dark mode preparado desde ya, aunque su tarjeta es de después del
    Seguimiento #2**: `@custom-variant dark (&:where(.dark, .dark *))`
    hace que `dark:` funcione por clase en `<html>` en vez de solo por
    `prefers-color-scheme` — así ningún componente que se construya
    mientras tanto (UI kit, Login, Calendario) necesita retocarse cuando
    llegue el toggle real; ese toggle solo tendrá que alternar la clase.
    Verificado en un navegador real (Chrome vía automatización): agregar
    la clase `dark` cambia el fondo/texto/color primario correctamente.
  - `prefers-reduced-motion` respetado a nivel de CSS global (punto 6:
    "ninguna animación debe bloquear la interacción"), antes de que
    exista ninguna animación real de Framer Motion todavía.
  - Alias `@/*` → `src/*` configurado tanto en `tsconfig.app.json` como
    en `vite.config.ts` (deben coincidir siempre que se agregue uno).
  - Providers ya montados en `main.tsx` (`QueryClientProvider`,
    `BrowserRouter`) con una única ruta placeholder en `App.tsx` — las
    rutas reales llegan con cada pantalla en su propia tarjeta, no se
    adelantan aquí.
  - Probado de verdad: `tsc -b` y `vite build` sin errores/warnings,
    `eslint .` limpio, y el dev server abierto en un Chrome real vía
    automatización — la página renderiza, los tokens de color de Tailwind
    se aplican, el toggle de `dark` funciona, y la consola del navegador
    no tiene errores.

- **Frontend: Set de componentes UI compartidos (Button, Input, Toast,
  Modal, Skeleton, Banner)** ✅ (`src/components/ui/`)
  - `Boton`: variantes primario/secundario/destructivo/icono, estados
    default/hover/disabled/loading (spinner), altura mínima 44px (Ley de
    Fitts, punto 12 — zona de pulgar cómoda en mobile), micro-interacción
    de Framer Motion en hover/tap.
  - `Input`: mismo indicador de campo obligatorio (asterisco rojo) y mismo
    estado de error (borde rojo + mensaje debajo) en todo el sistema,
    ligado con `aria-describedby` de verdad (punto 10, accesibilidad) —
    probado que el mensaje de error se asocia al campo, no solo se ve
    parecido.
  - **Toast**: `ToastProvider` + `useToast()` — un único punto de entrada
    para disparar notificaciones desde cualquier parte del sistema, 4
    variantes con el mismo color/ícono/duración (éxito y error con
    duración distinta a propósito: el error da más tiempo de lectura).
    `aria-live="polite"` para lectores de pantalla.
  - **Modal**: shell genérico con `createPortal` (evita que un `overflow`
    de un contenedor padre lo recorte) + **trampa de foco real** (Tab
    cicla dentro del diálogo, Escape cierra, el foco vuelve al elemento
    que abrió el modal al cerrar) — verificado con teclado de verdad en
    Chrome, no solo revisado a simple vista.
  - `ConfirmDialog`: construido sobre `Modal`, el único punto de
    confirmación para TODA acción destructiva del sistema — mismo texto
    "Cancelar"/"Confirmar" siempre, nunca redactado de nuevo por módulo.
  - `Skeleton`: átomo base + 3 patrones de composición
    (`SkeletonText`/`SkeletonCard`/`SkeletonTable`) para los 3 tipos de
    contenido que pide el punto 7 (texto, tarjeta, tabla) — Dashboard,
    Calendario, Reportes y Notificaciones los reusan tal cual en vez de
    inventar un spinner distinto cada uno.
  - `Banner`: mismo set de 4 variantes que Toast (comparten
    `feedback-variants.ts`, un solo lugar para colores/íconos de
    feedback en todo el sistema), para avisos persistentes tipo
    "suscripción vencida"/"negocio inactivo".
  - `MotionConfig reducedMotion="user"` agregado en `main.tsx`: la regla
    CSS de `prefers-reduced-motion` de la tarjeta de Setup solo cubre
    animaciones CSS puras — las animaciones de Framer Motion (whileHover,
    whileTap, AnimatePresence) son manejadas por JS y necesitan este
    wrapper aparte para respetar la preferencia del sistema operativo.
  - Se agregaron `clsx` + `tailwind-merge` (utilidad `cn()` en
    `lib/cn.ts`) y `lucide-react` para íconos — no estaban en el stack
    obligatorio del brief pero son estándar de facto para este patrón de
    componentes con variantes en Tailwind, de bajo riesgo.
  - **Probado de verdad en un Chrome real** (no solo compilado): las 5
    variantes de botón, el estado de error del Input, un toast de éxito y
    uno de error disparados por click, el `ConfirmDialog` abierto con
    backdrop blur, navegación por teclado dentro del modal (Tab cicla
    Cerrar→Cancelar→Confirmar→Cerrar), Escape cierra y devuelve el foco,
    y modo oscuro correcto en los 6 componentes a la vez. Se armó una
    página de showcase temporal para esta prueba y se borró antes de
    cerrar la tarjeta — no queda código de demostración en el repo.

- **Frontend: Login / Registro conectado al módulo Auth** ✅
  - **Backend, cambio pequeño pero necesario para que esto funcione de
    verdad**: se agregó `GET /auth/me` (protegido, devuelve el perfil
    público del usuario a partir del JWT). Sin este endpoint no había
    forma de restaurar la sesión al recargar la página — el access token
    solo trae `sub`/`idNegocio`/`rol`, no `nombreCompleto`/
    `correoElectronico` para mostrar en la UI. Con test unitario propio
    (`auth.service.spec.ts`, 2 casos) y probado contra la app real.
  - `src/lib/api.ts`: cliente HTTP único de la app. Adjunta el access
    token, y si una request autenticada responde 401, refresca UNA vez
    (varias llamadas 401 simultáneas comparten el mismo refresh en
    curso, para no disparar varios `/auth/refresh` en paralelo) y
    reintenta antes de rendirse. `ApiError` replica la forma exacta del
    filtro global del backend (`statusCode`/`errorCode`/`message`/`field`).
  - `src/context/AuthContext.tsx`: restaura la sesión al recargar la
    página (si hay algún token guardado, `/auth/me` confirma quién es;
    si el access ya expiró, `apiFetch` lo refresca solo antes de esto).
    Se suscribe a un callback de "sesión expirada" del cliente HTTP para
    cuando ni el refresh token sirve ya.
  - **Decisión técnica — tokens en localStorage**: el backend no usa
    cookies httpOnly (devuelve los tokens en el body), así que el
    frontend necesariamente los maneja accesibles por JS de un modo u
    otro. La mitigación real contra robo de token ya vive en el backend
    (access de vida corta + refresh rotativo con detección de reuso);
    mover a cookies httpOnly es un cambio de backend, fuera de esta
    tarjeta de frontend — anotado como posible mejora futura.
  - `RutaProtegida` (`components/layout/`): redirige a `/login`
    conservando de dónde venía (`state.from`), para volver ahí después de
    iniciar sesión.
  - **Primer uso de `react-hook-form` + `zod`** en el proyecto (agregados
    ahora, no estaban en el stack obligatorio): dado que esta es la
    primera tarjeta con formularios reales y vienen muchos más
    (Servicios, Clientes, wizard de Reserva), vale la pena esta base en
    vez de `useState` por campo. `contrasenaSchema` en
    `lib/validation.ts` replica la MISMA regla que
    `EsContrasenaValida()` del backend (punto 13: validar en ambos lados
    sin duplicar la fuente de verdad de negocio — el backend manda,
    esto es solo feedback instantáneo).
  - `RegistroPage`: el error `EMAIL_YA_REGISTRADO` del backend se mapea a
    un error de campo específico (`correoAdmin`) vía `setError` de
    react-hook-form, no a un toast genérico — mejor UX, y demuestra el
    patrón que las próximas pantallas con formularios deberían seguir
    para errores de negocio ligados a un campo.
  - **Probado de verdad en un Chrome real** con backend y frontend
    corriendo juntos: `/` redirige a `/login` sin sesión → login con el
    admin demo → sesión persiste tras recargar la página completa (RUTA
    de restauración vía `/auth/me` confirmada) → logout limpia
    `localStorage` y redirige → credenciales inválidas muestran el toast
    de error correcto → registro de un negocio nuevo entra directo
    autenticado → registrar el mismo correo de administrador dos veces
    muestra el error en el campo exacto, sin perder lo ya escrito en el
    resto del formulario → validación de campos obligatorios en el
    cliente antes de tocar la red.

- **Frontend: Calendario (FullCalendar) conectado a
  Reservas/Disponibilidad** ✅ — última tarjeta de Frontend priorizada
  para el Seguimiento #2.
  - **Backend, cambio pequeño pero necesario**: `ReservasService.listar()`
    y `obtenerUna()` no traían las relaciones `cliente`/`servicio`/
    `usuario` — el calendario los necesita para mostrar algo útil en vez
    de UUID crudos de las FK. Se agregó `relations: { cliente: true,
    servicio: true, usuario: true }` en ambos métodos, con test propio
    en `reservas.service.spec.ts`.
  - **Versión de FullCalendar fijada exacta**: verificado en npm que
    `@fullcalendar/core`/`react` están en `7.1.0` "latest", pero los
    plugins (`daygrid`/`timegrid`/`interaction`/`list`) siguen en
    `6.1.21` con `peerDependencies: "~6.1.21"` — se fijaron los 6
    paquetes a `6.1.21` exacto (sin `^`) para evitar un mismatch de
    versión mayor entre core y plugins.
    `CalendarioPage.tsx` (nueva): vistas mes/semana/agenda con locale
    español, filtro por empleado (de `/usuarios`), `businessHours`
    calculado desde `/disponibilidad`, click en evento abre modal de
    detalle con opción de cancelar (con `ConfirmDialog`), arrastrar un
    evento reprograma la reserva (revierte visualmente si el backend
    rechaza el cambio). Cambia sola entre vista de mes (desktop) y
    agenda/lista (mobile) según el ancho de ventana (Ley de Jakob, punto
    12 del brief — igual que Google Calendar/Calendly).
  - `AppLayout.tsx` (nuevo): barra superior con enlaces Turnify/Calendario
    y botón de logout, ahora usada por `InicioPage` y `CalendarioPage`.
  - `lib/reservas-api.ts`, `lib/disponibilidad-api.ts`, `lib/usuarios-api.ts`
    (nuevos): wrappers tipados sobre `apiFetch`. El límite por página del
    lado del frontend se fijó en 100 (no 200) porque
    `PaginationQueryDto` del backend tiene `@Max(100)` compartido por
    todos los listados — se decidió NO subir ese límite global solo para
    este caso de uso.
  - Tres bugs encontrados y corregidos durante pruebas en navegador real:
    1. El calendario nunca se montaba: `rango` (que habilita la query de
       reservas) solo lo fija el propio `datesSet` de FullCalendar, pero
       el calendario estaba oculto detrás de `isLoading` de esa misma
       query — candado sin salida. Ahora el calendario SIEMPRE se monta;
       solo un texto "Actualizando…" refleja `isLoading`/`isFetching`.
    2. `GET /reservas` devolvía 400: el frontend pedía `limit=200`, por
       encima del `@Max(100)` del backend (ver arriba).
    3. El tachado de una reserva cancelada no se veía: el CSS propio de
       FullCalendar (`.fc-event`) fuerza `text-decoration:none` y gana
       por especificidad sobre la clase `line-through` de Tailwind.
       Reemplazado por el sufijo explícito `" (cancelada)"` en el título
       del evento — además más accesible, ya que un lector de pantalla
       no anuncia un tachado puramente visual.
  - **Probado de verdad en un Chrome real** con backend + Postgres reales:
    vistas mes/semana/agenda en español; click en evento → modal de
    detalle → cancelar → confirmar (toast, estado en BD, título con
    "(cancelada)" y opacidad reducida); arrastrar un evento a otro día
    (simulado con una secuencia realista de eventos de mouse, ya que un
    solo salto instantáneo no dispara el umbral de drag de FullCalendar)
    → reprograma y se confirma persistido con una llamada de API de
    verificación aparte; filtro de empleado puebla desde `/usuarios`.
    Limitación honesta: la herramienta de redimensionar ventana del
    entorno de pruebas no cambia el `window.innerWidth` real de la
    página, así que el disparo automático del cambio de vista al cruzar
    el punto de quiebre mobile no se pudo verificar con un viewport
    angosto real — sí se verificó manualmente que la vista de Agenda
    (el destino de ese cambio) funciona correctamente al seleccionarla
    a mano.

## Seguridad — categoría cerrada completa
Las 9 tarjetas de la categoría (ver docs/spec.md punto 18) ya estaban
implementadas desde el módulo Auth en adelante, salvo 2 que se cerraron
ahora explícitamente:

- **Seguridad: Rate limiting en endpoints públicos (reserva pública,
  login)** ✅ (nueva) — `@nestjs/throttler` 6.7.0. Límite global de 60
  req/min por IP (`ThrottlerGuard` como `APP_GUARD` en `AppModule`), y un
  límite más estricto de 5 req/min en `/auth/registro`, `/auth/login` y
  `/auth/refresh` (`@Throttle`) por ser los endpoints públicos más
  expuestos a fuerza bruta/abuso — no hay todavía un endpoint de reserva
  pública (es tarjeta de después del Seguimiento #2), así que ese caso se
  cubrirá con el mismo patrón cuando se construya. La respuesta 429 pasa
  por el mismo filtro global de errores (`errorCode: DEMASIADAS_SOLICITUDES`).
  Verificado contra el servidor real (Postgres real, sin mocks): 5
  intentos de login seguidos devuelven 401, el 6to devuelve 429 con el
  shape estándar; no hay test automatizado de esto porque los tests
  actuales son unitarios contra servicios (sin un servidor HTTP real
  escuchando) — automatizarlo es un caso natural para la futura tarjeta
  de QA "Tests de integración de endpoints principales".
- **Seguridad: npm audit de dependencias antes de cada entrega/seguimiento**
  ✅ — re-confirmado en una sesión posterior una vez que
  registry.npmjs.org salió de mantenimiento (había devuelto 503 en todos
  los intentos anteriores): `npm audit` en los 3 workspaces (raíz,
  `apps/backend`, `apps/frontend`) da **0 vulnerabilidades**.
- Las 7 restantes ya estaban cubiertas por trabajo previo, cerradas aquí
  solo formalmente: hasheo bcryptjs + política de contraseña (Auth), JWT
  corto + refresh rotativo con detección de reuso (Auth), guard de rol
  (`RolesGuard`, Auth), guard multi-tenant (`TenantContextInterceptor` +
  `TenantScopedRepository`), `class-validator` en todos los DTOs, `.env`
  fuera del repo (`.gitignore` desde el primer commit), y CORS restringido
  a un solo origen configurable por env (`CORS_ORIGIN`, `credentials:
  true`) en `main.ts` desde la tarjeta de Setup. La única tarjeta de
  Seguridad que NO aplica todavía es "Rate limiting en el
  endpoint/gateway del chatbot" — no tiene sentido cerrarla porque el
  chatbot (punto 16 del brief) ni siquiera se ha empezado a construir.

También de esta sesión: la contraseña de la base de datos de Supabase,
que se había compartido en texto plano en un chat, ya fue rotada por el
equipo y se confirmó que `DATABASE_URL` sigue conectando (cero cambios de
código necesarios).

## Plantillas de servicio por vertical (punto 2 del brief) — 5 tarjetas nuevas
Agregadas a docs/spec.md después de haber cerrado DB/Backend/Frontend la
primera vez — son incrementales sobre módulos ya terminados (Auth,
Negocios, Servicios), no un rediseño.

- **DB: Seed del catálogo estático de plantillas de servicio por
  tipo_negocio** ✅ — nueva tabla `plantillas_servicio` (entidad
  `PlantillaServicio`, migración `PlantillaServicioCatalog`, generada con
  `migration:generate` contra el Postgres real y revisada a mano: el
  auto-generador de TypeORM propuso de más un `DROP CONSTRAINT` sobre la
  exclusion constraint de no-traslape de Reservas —un falso positivo
  documentado porque esa constraint se creó con SQL crudo, TypeORM no la
  reconoce como parte de la entidad— se quitó esa línea antes de correr
  la migración). Sin `id_negocio` (no es dato de un tenant) y sin
  endpoints de escritura. Sembrada con `npm run seed:plantillas` (dentro
  de `apps/backend`): 60 filas, 6-9 servicios sugeridos por cada una de
  las 9 verticales con plantilla (`otro` no tiene, por diseño). El seed
  hace `TRUNCATE` + reinsertar completo, así que correrlo de nuevo tras
  ajustar el catálogo en docs/spec.md no duplica filas.
- **Backend: Validar tipo_negocio (enum de verticales) en el DTO de
  registro** ✅ — nuevo enum `TipoNegocio` en `database/entities/enums.ts`
  (10 valores del punto 1 del brief), usado por `PlantillaServicio.tipoNegocio`
  y ahora por `RegistroNegocioDto.tipoNegocio` vía `@IsEnum`. Antes era
  `@IsString()` de texto libre. Se mantiene la columna `negocios.tipo_negocio`
  como `varchar` (sin migrar a un enum de Postgres) porque el brief pide
  explícitamente validar en el DTO, no rediseñar el módulo Auth ya
  cerrado. Nuevo módulo de solo lectura `plantillas-servicio`
  (`GET /plantillas-servicio?tipoNegocio=...`, autenticado, sin guard de
  tenant porque el dato es global) para que el frontend consuma el
  catálogo. Con test unitario propio y verificado contra el servidor
  real: `tipoNegocio` inválido → 400 con el mensaje que lista los valores
  válidos; `tipoNegocio` válido → 201 y el catálogo correcto por `GET
  /plantillas-servicio`.
- **Frontend: Componente Input compartido — variante crear (foco verde)
  vs editar (foco azul)** ✅ — nuevo `campo-variante.ts` (`CLASES_FOCO_VARIANTE`,
  compartido) y prop `variante?: 'crear' | 'editar' | 'neutro'` en `Input`;
  nuevo componente `Select` (misma API que `Input`: label, error, hint,
  requerido, aria-describedby) para no reinventar un `<select>` suelto la
  próxima vez que haga falta uno en un formulario — usado ahora en
  `RegistroPage` para el campo Tipo de negocio (antes era texto libre,
  ver la tarjeta de abajo). Sin variante, el foco queda neutro (indigo,
  como antes) — usado así en Login, que no es un formulario de
  crear/editar un registro. Verificado en un Chrome real: foco verde
  visible en los campos de Registro.
- **Frontend: Paso de onboarding tras el registro — selección de tipo de
  negocio + plantilla de servicios sugeridos** ✅ — `RegistroPage` cambia
  el campo Tipo de negocio de texto libre a un `Select` con las 10
  verticales fijas (antes se podía escribir cualquier texto). Tras
  registrarse, en vez de ir directo a `/`, redirige a la nueva
  `OnboardingPage` (`/onboarding`, ruta protegida): trae el negocio recién
  creado (`GET /negocios/mi-negocio`) y su catálogo de plantillas (`GET
  /plantillas-servicio`), muestra checkboxes ("¿cuáles ofreces?"), y al
  continuar crea un `POST /servicios` por cada una marcada (precio
  sugerido de arranque ₡5000 — no hay un precio real de referencia en el
  catálogo, el admin lo edita después, tal como pide el brief). Si el
  tipo de negocio es `otro` o no hay plantillas, muestra directo el
  mensaje de "crea tus servicios desde cero" con un botón para continuar
  sin crear nada. Nuevos `lib/negocios-api.ts`, `lib/plantillas-servicio-api.ts`,
  `lib/servicios-api.ts`.
- **QA: Verificar que el flujo de plantillas por vertical no rompe el
  registro/onboarding ya existente** ✅ — probado de verdad contra
  backend + Postgres reales: registro con `tipoNegocio=spa` → onboarding
  muestra las 7 plantillas de spa → se seleccionan 2 → "Crear 2
  servicio(s) y continuar" → redirige a `/` → confirmado por API que los
  2 servicios quedaron creados con nombre/duración correctos y el precio
  por defecto. Registro con `tipoNegocio=otro` → confirmado que no
  rompe el registro (sigue devolviendo sesión válida). El camino "sin
  plantillas" de `OnboardingPage` (antes solo validado por API + revisión
  de código) se confirmó después con click-through real en Chrome: al
  registrar con `tipoNegocio=otro`, `/onboarding` muestra "Estas son
  sugerencias comunes para Otro" + el mensaje "No hay plantillas
  sugeridas para tu tipo de negocio — puedes crear tus servicios desde
  cero cuando quieras" con un único botón "Continuar" (sin checkboxes);
  al hacer click redirige a `/` y se confirmó por API que no se creó
  ningún `SERVICIO` para ese negocio (`GET /servicios` → `total: 0`).
  Ambos caminos del onboarding (con y sin plantillas) quedan así
  verificados de punta a punta en navegador real.

## Notificaciones — 2 tarjetas cerradas (Resend + Meta WhatsApp Cloud API)
Cambio de proveedor a mitad de esta categoría: Twilio bloqueó la
verificación de cuenta del equipo, así que docs/spec.md se actualizó para
usar **Meta WhatsApp Cloud API** (modo sandbox de prueba) en vez de
Twilio Sandbox en todo el documento — ver commit de docs. Las 2 tarjetas
de Worker de Notificaciones se cierran juntas porque comparten el mismo
worker, solo cambia el proveedor de envío.

- **Backend: Worker de Notificaciones — integración Resend (email)** ✅
- **Backend: Worker de Notificaciones — integración Meta WhatsApp Cloud
  API (modo sandbox de prueba)** ✅
  - **Decisión técnica — cola de trabajo**: `@nestjs/schedule` (node-cron
    por debajo) en vez de BullMQ+Redis. El brief autoriza este fallback
    explícitamente si BullMQ+Redis "no es viable", y el proyecto no tenía
    Redis en ningún lado todavía — agregarlo solo para esto era
    infraestructura nueva sin un beneficio claro para el alcance actual.
    `NotificacionesService.procesarPendientes()` corre cada minuto
    (`@Cron(CronExpression.EVERY_MINUTE)`), revisa
    `NOTIFICACION.estado=pendiente AND programado_para <= now()` (máx. 50
    por corrida) y despacha por canal.
  - `ResendService` y `WhatsappCloudApiService` (`modules/notificaciones/providers/`):
    envoltorios inyectables sobre cada proveedor externo (Clean
    Architecture, punto 14 — capa de infraestructura aislada y
    mockeable), nunca llamados directo desde `NotificacionesService`.
    WhatsApp usa `fetch` nativo contra la Graph API de Meta (`v26.0`,
    versión vigente verificada en la documentación oficial, no asumida
    de memoria) — no hay SDK oficial de Node para la Cloud API y agregar
    un wrapper de terceros no verificado no vale la pena para un solo
    endpoint REST.
  - **Notificacion no tiene id_negocio** (por diseño del ER original) —
    `NotificacionesModule` usa un `Repository` normal, no
    `TenantScopedRepository`, mismo caso documentado que `NegociosService`:
    el worker necesita procesar pendientes de TODOS los negocios en cada
    corrida, no solo del tenant de una request.
  - **Disparo real**: `ReservasService.crear()` y `.cancelar()` ahora
    inyectan `NotificacionesService` y programan una notificación
    (`CONFIRMACION`/`CANCELACION`) fuera de la transacción de la reserva
    — si el registro de la notificación fallara, no debe revertir una
    reserva ya confirmada; el envío real en sí lo reintenta el propio
    worker. `RECORDATORIO` (aviso anticipado antes de la cita) queda
    fuera de esta tarjeta — necesitaría un segundo cron que mire
    reservas próximas, no solo procesar lo ya encolado; anotado como
    mejora futura, no bloquea el alcance de "Worker de Notificaciones"
    tal como está escrito en el backlog.
  - **Idioma del mensaje** (punto 10 del brief: se genera en el idioma
    preferido del CLIENTE, nunca el del negocio, desde el primer módulo
    que lo necesite): `mensajes-notificacion.ts` es un diccionario ES/EN
    mínimo *solo* para el texto de notificaciones — cuando se construya
    la tarjeta de "i18n backend" con `nestjs-i18n`, este archivo se
    reemplaza por claves de traducción reales sin tocar
    `NotificacionesService`. Fecha/hora del mensaje formateada en hora
    de Costa Rica con `Intl.DateTimeFormat` (nueva
    `formatearFechaHoraLocalCR` en `zona-horaria-negocio.ts`).
  - **Reintentos**: hasta `MAX_REINTENTOS=3` fallos consecutivos antes de
    marcar `FALLIDA` (si no, sigue `PENDIENTE` y el próximo tick del cron
    reintenta).
  - Variables de entorno nuevas (opcionales a propósito — el worker
    marca la notificación como fallida con un motivo claro si faltan, en
    vez de tumbar el arranque de todo el servidor por un secreto de una
    feature específica): `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default
    `onboarding@resend.dev`, el remitente de prueba sin dominio
    verificado), `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
  - **Probado de verdad con proveedores reales, no solo mocks de test**
    (además de 6 tests unitarios propios en
    `notificaciones.service.spec.ts` cubriendo programar/enviar/reintentar/agotar):
    se creó un negocio + cliente + reserva real contra Postgres real, lo
    que disparó una notificación de confirmación real. Resultado en la
    tabla `notificaciones` tras el tick del cron:
    - **WhatsApp**: enviado con éxito a un número real vía Meta Graph
      API — confirmado por el usuario que el mensaje llegó de verdad a
      su WhatsApp con el contenido esperado ("Tu reserva de ... quedó
      confirmada").
    - **Email**: el primer intento falló con un error real y útil de
      Resend ("solo puedes enviar a tu propia dirección sin dominio
      verificado") — reveló que la dirección real de la cuenta de Resend
      no era la que se asumió al principio; corregido usando la
      dirección correcta, reintentado, y confirmado `estado: enviada`.
    - **Limitación real de WhatsApp Business descubierta en esta prueba
      (no es un bug de Turnify)**: un mensaje de texto libre (el que usa
      este worker) solo se entrega si el cliente le escribió primero al
      número de negocio en las últimas 24 horas (ventana de servicio al
      cliente de WhatsApp). El primer intento a un cliente que nunca le
      había escrito al negocio de prueba falló; tras que el cliente le
      escribiera al negocio abriendo esa ventana, el reenvío sí llegó.
      Documentado como comentario en `whatsapp-cloud-api.service.ts` —
      Turnify va a necesitar plantillas de WhatsApp pre-aprobadas por
      Meta más adelante para que las notificaciones lleguen también a
      clientes que reservan por primera vez sin haberle escrito nunca al
      negocio. No bloquea esta tarjeta (el worker y la integración
      funcionan correctamente; es una restricción de la plataforma de
      WhatsApp, no del código).

## Suscripciones — Stripe Test Mode + webhook + guard de límites del plan gratis
**Backend: Módulo Suscripciones — Stripe Test Mode + webhook + guard de
límites del plan gratis** ✅

**Limitación real, NO técnica, confirmada por el equipo — no es una
credencial pendiente de conseguir**: Costa Rica no está entre los países
donde Stripe permite abrir cuenta, ni siquiera en modo de pruebas. Por
esto, a diferencia de Resend/Meta WhatsApp (que sí se verificaron contra
APIs reales), el módulo de Suscripciones se implementó completo contra la
API oficial de Stripe pero **nunca pudo probarse contra un checkout o
webhook real** — su cobertura real es únicamente vía tests unitarios con
el SDK de Stripe mockeado. No hay ninguna acción futura de "conseguir la
credencial" que vaya a resolver esto — es un límite geográfico de la
plataforma, documentado también en `stripe.service.ts` y `.env.example`.

- `StripeService` (`modules/suscripciones/providers/`): envoltorio
  inyectable sobre el SDK oficial `stripe` (v22.6.2). `crearCheckoutSession`
  arma un Checkout Session en modo `subscription` con `metadata.idNegocio`
  y `client_reference_id` (para que el webhook sepa a qué negocio aplicar
  el cambio de plan); `construirEvento` verifica la firma HMAC del
  webhook (`stripe.webhooks.constructEvent`). Sin credenciales
  configuradas, ambos métodos fallan con un error claro en vez de un
  crash — `crearCheckoutSession` como `ServiceUnavailableException` 503
  (`PASARELA_PAGOS_NO_DISPONIBLE`), verificado contra el servidor real.
- `main.ts`: `NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })`
  — el webhook necesita el body sin parsear para verificar la firma;
  parsearlo primero invalida cualquier verificación.
- Webhook (`POST /suscripciones/webhook`, `@Public()`): idempotente sin
  tabla nueva de eventos — antes de aplicar `checkout.session.completed`
  revisa si ya existe una `Suscripcion` con ese `idPagoPasarela`
  (session/subscription id de Stripe); si ya existe, no duplica. Maneja
  también `customer.subscription.updated` (past_due/unpaid → SUSPENDIDA)
  y `customer.subscription.deleted` (→ CANCELADA, negocio vuelve a
  GRATIS). Firma inválida → 400, verificado contra el servidor real.
- Guard `LimitePlanGratisGuard` + decorador `@LimitePlan('usuarios' | 'servicios' | 'reservas')`,
  aplicado en `POST /usuarios`, `POST /servicios` y `POST /reservas`.
  Límites del punto 5.1 del brief: 1 usuario, 3 servicios activos, 20
  reservas/mes calendario (UTC, no vale la pena convertir a mes-CR para
  una cuota tan gruesa). Si el negocio ya está en un plan de pago
  (`Negocio.planSuscripcion`, el valor denormalizado que el webhook
  mantiene sincronizado), el guard no hace ninguna consulta de conteo.
  **Probado de verdad contra el servidor real**: negocio nuevo (plan
  gratis) → 3 servicios se crean, el 4to responde `403
  LIMITE_PLAN_ALCANZADO`; crear un 2do usuario responde el mismo error.
- **Dos gotchas reales de NestJS encontrados y corregidos durante esta
  prueba** (no bugs de lógica de negocio — de cómo Nest resuelve
  dependencias):
  1. Un guard aplicado vía `@UseGuards(Clase)` se instancia con el
     inyector del **módulo consumidor** (`UsuariosModule`,
     `ServiciosModule`, `ReservasModule`), no con el del módulo donde
     está declarado (`SuscripcionesModule`) — si dependiera directo de
     un `Repository` de TypeORM, fallaba con "is NegocioRepository part
     of the current Module?" en cualquier módulo sin ese
     `TypeOrmModule.forFeature(...)` propio. Solución: mover el conteo a
     `LimitesPlanService`, un provider normal exportado por
     `SuscripcionesModule` (sí sigue la resolución de DI estándar), y
     dejar el guard dependiendo solo de eso.
  2. Los **Guards de Nest corren TODOS antes que los Interceptors**
     (orden real: Guards → Interceptors → Pipes → Handler). Como
     `TenantContextService` lo llena el `TenantContextInterceptor`, un
     Guard que lo use encuentra el contexto vacío ("no hay contexto de
     negocio activo") — confirmado con el error real del servidor.
     Solución: el guard lee `idNegocio` directo de `request.user` (lo
     pone `JwtAuthGuard`, que sí corre antes en la misma fase de
     Guards), nunca de `TenantContextService`.
- Nota de producto (no arreglada en esta tarjeta, anotada para no
  perderla): el `OnboardingPage` del frontend (tarjeta de plantillas por
  vertical) puede intentar crear más de 3 servicios de una plantilla con
  muchas sugerencias (ej. salón de belleza, 9 plantillas) para un negocio
  recién registrado en plan gratis — los primeros 3 `POST /servicios` del
  `Promise.all` tendrán éxito y el resto fallará con
  `LIMITE_PLAN_ALCANZADO`, mostrando un toast de error genérico en vez de
  un mensaje que explique cuáles sí se crearon. Es una interacción real
  entre dos tarjetas construidas en sesiones distintas, no descubierta
  hasta ahora porque el guard no existía todavía cuando se construyó el
  onboarding.
- 12 tests unitarios nuevos (`suscripciones.service.spec.ts`,
  `limites-plan.service.spec.ts`, `limite-plan-gratis.guard.spec.ts`,
  `stripe.service.spec.ts` con el SDK de Stripe mockeado vía `vi.mock`).

## Reportes — agregaciones (reservas por período, ingresos estimados)
**Backend: Módulo Reportes — agregaciones (reservas por período, ingresos
estimados)** ✅

- `GET /reportes/resumen?desde=&hasta=` (ISO 8601, `@IsDateString`,
  `desde > hasta` → 400 `RANGO_DE_FECHAS_INVALIDO`) devuelve:
  - `reservasPorEstado`: conteo por cada valor de `EstadoReserva`
    (siempre las 4 claves presentes, en 0 si no hay filas — para que el
    frontend no tenga que manejar `undefined`).
  - `reservasPorDia`: conteo agrupado por día calendario (`DATE_TRUNC`),
    todas las reservas del rango sin importar estado (para una gráfica
    de volumen, no de ingresos).
  - `ingresosEstimados`: suma de `Servicio.precio` de las reservas NO
    canceladas en el rango. Se llama "estimados" a propósito, no
    "ingresos": Turnify no cobra por reserva individual (el único cobro
    real es la SUSCRIPCION del negocio a la plataforma vía Stripe), así
    que esto es una proyección desde el catálogo de precios, no dinero
    efectivamente cobrado — el nombre del campo lo deja explícito.
- **Nuevo `TenantScopedRepository.createQueryBuilder(alias)`**: los
  métodos existentes del wrapper (find/save/update/etc.) no cubrían
  agregaciones (`COUNT`/`SUM`/`GROUP BY`) — se agregó este método al
  wrapper transversal en vez de que `ReportesService` filtrara
  `idNegocio` a mano, mismo principio del guard multi-tenant ("nunca
  repetido manualmente en cada servicio"). Reutilizable por cualquier
  módulo futuro que necesite agregaciones.
- **Probado de verdad contra Postgres real**: negocio de prueba con 3
  reservas (2 el mismo día, 1 al día siguiente), una de las 3 cancelada
  después de creada. `GET /reportes/resumen` devolvió exactamente
  `reservasPorEstado: {confirmada: 2, cancelada: 1}`,
  `reservasPorDia: [{fecha, cantidad:2}, {fecha, cantidad:1}]`, e
  `ingresosEstimados` igual a 2× el precio del servicio (la cancelada
  quedó correctamente excluida) — confirmado que el filtro de
  `estado != cancelada` sí se aplica en la query, no solo en el conteo
  por estado.
- 4 tests unitarios nuevos (`reportes.service.spec.ts`) + 1 test nuevo
  para `createQueryBuilder()` en `tenant-scoped.repository.spec.ts`.

## Documentación Swagger/OpenAPI en todos los endpoints
**Backend: Documentación Swagger/OpenAPI en todos los endpoints** ✅

Antes de esta tarjeta ya había cobertura básica (`@ApiTags`,
`@ApiBearerAuth`, `@ApiProperty` en todos los DTOs) pero **cero**
endpoints tenían `@ApiOperation` — `/docs` mostraba las rutas sin
explicar qué hace cada una.

- `@ApiOperation({ summary })` agregado a los 39 endpoints de los 11
  controllers del backend (auditado por conteo real: `grep` de
  `@Get|@Post|@Patch|@Delete` vs `@ApiOperation`, ambos dan 39).
- Nuevo `ErrorResponseDto` (`common/errors/error-response.dto.ts`)
  documenta en Swagger la forma estándar de error del punto 7/8 del
  brief (`{statusCode, errorCode, message, field?}`) — no se usa en
  código, solo describe la respuesta para quien lea `/docs`.
- Nuevo decorador compuesto `@ErroresEstandar()`
  (`common/swagger/errores-estandar.decorator.ts`): aplicado a nivel de
  clase en cada controller autenticado, documenta 400/401/403/404 con
  `ErrorResponseDto` sin repetir `@ApiResponse` en cada endpoint — mismo
  principio de "nunca repetido a mano" que el resto de wrappers
  transversales del proyecto.
- **Probado de verdad contra el servidor real**: `GET /docs-json` parsea
  como JSON válido, expone exactamente 39 operaciones (una por endpoint
  real), las 39 tienen `summary` no vacío, `ErrorResponseDto` aparece en
  `components.schemas`, y `GET /docs` devuelve la UI de Swagger (200,
  `<title>Swagger UI</title>`).

**De paso, 2 tarjetas más de la lista quedan cerradas retroactivamente
por trabajo ya hecho en sesiones anteriores de este mismo backlog —
anotado aquí para que el equipo no las espere**:
- **Backend: Guard de límites por plan freemium (bloquear acciones al
  superar límites del plan gratis)** ✅ — es el mismo `LimitePlanGratisGuard`
  construido y verificado en la tarjeta de Suscripciones (ver esa
  sección arriba); el título de esa tarjeta ya incluía este guard
  explícitamente ("... + guard de límites del plan gratis").
- **Backend: Validar tipo_negocio (enum de verticales) en el DTO de
  registro, sobre el módulo Auth ya existente** ✅ — hecho en la sesión
  de "Plantillas de servicio por vertical" (ver esa sección arriba,
  `RegistroNegocioDto.tipoNegocio` con `@IsEnum(TipoNegocio)`). Aparece
  duplicada al final de la lista de Backend porque también se agregó en
  el punto 2 del brief cuando se sumaron las 5 tarjetas de plantillas.

## i18n backend (nestjs-i18n, mensajes de validación/errores ES/EN)
**Backend: i18n backend (nestjs-i18n, mensajes de validación/errores
ES/EN)** ✅

- `I18nModule.forRoot()` (`app.module.ts`), global, español por defecto
  (`fallbackLanguage: 'es'`, mercado objetivo Costa Rica). Resolvers:
  `?lang=en` y el header `Accept-Language` — cualquiera de los dos elige
  el idioma de una request puntual. Archivos en
  `apps/backend/src/i18n/{es,en}/{errores,validacion,notificaciones}.json`,
  copiados a `dist/i18n` en cada build (`nest-cli.json` →
  `compilerOptions.assets`).
- **Errores**: `AllExceptionsFilter` ahora traduce por `errorCode` — nuevo
  método `traducir()` que llama `i18n.translate('errores.<CODE>', {lang,
  defaultValue: mensajeOriginal})`. `defaultValue` es la clave: si un
  errorCode no tiene traducción todavía, el filtro sigue funcionando con
  el mensaje original en vez de romperse. 31 de los 32 `errorCode`
  distintos del backend ya tienen traducción ES/EN real; el único que
  queda fuera de este mecanismo genérico es `LIMITE_PLAN_ALCANZADO`
  (un solo código para 3 mensajes distintos según el recurso) — ese se
  tradujo aparte, directo en `LimitePlanGratisGuard`, con 3 claves
  (`LIMITE_PLAN_USUARIOS/SERVICIOS/RESERVAS`).
- **Validación**: `EsContrasenaValida()` usa `i18nValidationMessage('validacion.CONTRASENA_INVALIDA')`
  en vez de un string fijo — se resuelve en el momento de la validación
  (antes de que `validationExceptionFactory` arme la respuesta), así que
  no hizo falta tocar el ValidationPipe ni la factory existentes. Se hizo
  solo con la contraseña como caso representativo (usado por
  Registro/futuros formularios de cambio de contraseña); migrar los ~30
  mensajes de validación restantes del resto de DTOs a claves de i18n es
  mecánico pero no se hizo completo en esta tarjeta — la mayoría de esos
  mensajes son explicaciones de formato de campo, no texto de cara al
  cliente final como sí lo son los errores y las notificaciones.
- **Notificaciones**: se cumplió la promesa dejada en la tarjeta de
  Notificaciones — `mensajes-notificacion.ts` ya NO tiene un diccionario
  ES/EN a mano, ahora llama `I18nService.translate()` con `lang:
  cliente.idiomaPreferido` explícito (nunca el resolver de la request:
  el admin que crea la reserva y el cliente que la recibe pueden hablar
  idiomas distintos) e interpolación de `{nombreServicio}`/`{fechaHoraTexto}`
  vía `args`.
- **Probado de verdad contra el servidor real**: `POST /auth/login` con
  credenciales inválidas devuelve `"Correo o contraseña incorrectos"`
  sin header, y `"Incorrect email or password"` con
  `Accept-Language: en` — mismo `errorCode`, mensaje traducido. Reserva
  creada con `Accept-Language: es` para un cliente con
  `idiomaPreferido: en`: el mensaje guardado en `notificaciones` salió en
  inglés genuino ("Booking confirmed... has been confirmed.", fecha en
  formato `en-US`) — confirma que el idioma de la notificación depende
  del CLIENTE, no de la request que disparó la reserva.
- 5 tests unitarios nuevos (`all-exceptions.filter.spec.ts`, 4 casos) +
  ajuste de `notificaciones.service.spec.ts` para mockear
  `I18nService.translate()` con interpolación real.

## Guard de privilegios por nivel_cliente (Gratis vs Premium)
**Backend: Guard de privilegios por nivel_cliente (Gratis vs Premium),
limitado por el plan del negocio** ✅

Punto 5.2 del brief: el nivel Premium de un CLIENTE desbloquea un canal
de notificación adicional (WhatsApp), pero **siempre limitado por el
techo que impone el plan del propio NEGOCIO** — el ejemplo textual del
brief ("un cliente Premium de un negocio en Plan Gratis igual no recibe
WhatsApp") es literalmente el escenario que este guard bloquea.

- `PrivilegioClienteGuard` + `PrivilegiosClienteService`
  (`modules/clientes/`), aplicado en `POST /clientes` y `PATCH /clientes/:id`
  vía `@UseGuards`. Solo actúa cuando el body trae `canalPreferido: whatsapp`;
  cualquier otro canal pasa de largo sin consultar nada.
  - Bloquea con `errorCode: PRIVILEGIO_CLIENTE_NO_DISPONIBLE` (el mismo
    que da de ejemplo el brief) si el nivel efectivo del cliente no es
    `premium`, **o** si `Negocio.planSuscripcion === gratis` — dos
    chequeos independientes, cada uno con su propio mensaje traducido
    (`errores.PRIVILEGIO_CLIENTE_NIVEL` / `..._PLAN_NEGOCIO`).
  - "Nivel efectivo": el `nivelCliente` del body si viene, si no el del
    cliente ya guardado en BD (para un `PATCH` que solo cambia
    `canalPreferido` sin tocar `nivelCliente`), si no `GRATIS` (default
    de un cliente nuevo).
  - A diferencia de `LimitePlanGratisGuard`, este guard vive por completo
    DENTRO de `ClientesModule` (no se reutiliza en otros módulos) — sin
    el gotcha de "guard instanciado por el módulo consumidor" porque
    aquí guard y servicio comparten el mismo módulo.
- **Probado de verdad contra el servidor real** con un negocio real:
  1. Cliente nuevo con `canalPreferido: whatsapp` y `nivelCliente` por
     defecto (gratis) → 403, mensaje de nivel.
  2. Mismo canal con `nivelCliente: premium`, negocio todavía en Plan
     Gratis → 403, pero esta vez el mensaje es el de plan del negocio
     (confirma que ambos checks son independientes y se distinguen).
  3. Negocio actualizado a plan de pago directo en BD → la misma
     creación anterior ahora responde 201.
  4. `PATCH` a un cliente existente (nivel gratis) con solo
     `canalPreferido: whatsapp` (sin `nivelCliente` en el body) → 403
     (usa el nivel actual de BD); el mismo `PATCH` agregando
     `nivelCliente: premium` → 200.
- 8 tests unitarios nuevos (`privilegios-cliente.service.spec.ts`,
  `privilegio-cliente.guard.spec.ts`).

## Módulo Chatbot (WebSocket Gateway + integración con LLM — Groq) ✅
**Backend: Módulo Chatbot — WebSocket Gateway + integración con LLM
(contexto por rol y por negocio)** — cerrado, con generación de texto
real funcionando de punta a punta. Proveedor actual: **Groq** (API
compatible con el SDK de OpenAI, modelo `openai/gpt-oss-20b` del tier
gratuito) — segundo proveedor de este módulo, ver "Cambio de proveedor"
más abajo para por qué se abandonó Google Gemini, el primero.

- **Desacoplado del proveedor** (requisito explícito, y la razón por la
  que cambiar de proveedor a mitad de camino fue barato): `LlmClient`
  (interfaz) + token de DI `LLM_CLIENT` + `GroqLlmClient` (adaptador
  concreto, reusa el SDK oficial `openai` apuntando a
  `https://api.groq.com/openai/v1`). Cambiar de proveedor es escribir una
  clase nueva que implemente `LlmClient` y cambiar un `useClass` en
  `ChatbotModule` — nada más del módulo se tocó ni al pasar de Gemini a
  Groq ni debería tocarse en un cambio futuro.
- **SDK real verificado contra el paquete instalado** (`openai@7.20.0`),
  no de memoria: `client.chat.completions.create({..., stream: true})`
  devuelve un `Stream<ChatCompletionChunk>` async-iterable, el texto de
  cada chunk viene en `choices[0].delta.content`. A diferencia de Gemini,
  esta API no tiene un campo separado para el system prompt — va como un
  mensaje `role: 'system'` más al inicio de `messages`, y los turnos
  previos del asistente usan `role: 'assistant'` (no `'model'`).
- **Contexto por rol y por negocio, multi-tenant real**: `ChatbotService`
  arma el prompt dentro de `TenantContextService.run(...)` — el MISMO
  mecanismo que usa cualquier endpoint HTTP — y reutiliza
  `NegociosService`/`ServiciosService`/`ReservasService` ya existentes en
  vez de consultar la base de datos directo. Esta capa no cambió nada al
  cambiar de proveedor — vive en `ChatbotService`, no en el adaptador.
- **Privacidad (instrucción explícita del equipo, independiente del
  proveedor)**: el contexto que se arma nunca incluye datos de CLIENTE ni
  credenciales — solo nombre/tipo/plan del negocio propio y conteos
  genéricos (servicios activos, reservas de hoy). Un tier gratuito de
  cualquier proveedor de LLM puede usar prompts/respuestas para mejorar
  sus productos, así que esta regla no es específica de Gemini ni de Groq.
- **Límite de mensajes por plan freemium** (punto 5): `RecursoLimitado`
  ganó un 4to valor (`mensajesChatbot`, 10/día en Plan Gratis) y
  `LimitesPlanService`/`LimitePlanGratisGuard` se extendieron para
  soportarlo — ver "3 bugs reales encontrados" abajo, el guard tuvo que
  volverse transporte-agnóstico (HTTP + WebSocket).
- **Nueva tabla** `mensajes_chatbot` (entidad `MensajeChatbot`,
  migración `1789870670041-MensajeChatbot`) guarda pregunta+respuesta de
  cada turno — con `idUsuario` (no `idCliente`: hoy solo el staff
  autenticado puede usar el chatbot, el widget del cliente final necesita
  el wizard público + auth de cliente, todavía no construidos).
- **Degradación real, no solo documentada**: si el LLM falla (o no hay
  `LLM_API_KEY`), `ChatbotService.responder()` cae a un mensaje amable en
  vez de romper la conexión — y el turno igual se guarda en BD. Se
  verificó de punta a punta en ambos sentidos: fallando en vivo (con
  Gemini bloqueado) y respondiendo en vivo (con Groq).

### 3 bugs reales encontrados y arreglados verificando de punta a punta
Los guards/interceptors globales de la app se escribieron pensando solo
en HTTP (Express `req`/`res`); el chatbot es el primer WebSocket de
Turnify y expuso tres puntos donde esa suposición no se sostiene. Los
tres se encontraron con una conexión socket.io real contra el servidor
real, no en un mock:
1. **`ThrottlerGuard` (global, `APP_GUARD`) revienta en WS** con
   `res.header is not a function` — su `getRequestResponse()` asume
   Express. Fix: `AppThrottlerGuard extends ThrottlerGuard` con
   `shouldSkip()` que salta contextos `'ws'` (el WebSocket del chatbot ya
   tiene su propio control de abuso: auth obligatoria + límite de
   mensajes/día).
2. **`JwtAuthGuard` (global, `APP_GUARD`) revienta en WS** con
   `Cannot read properties of undefined (reading 'authorization')` — en
   un contexto `'ws'`, `switchToHttp().getRequest()` devuelve el propio
   socket, no una `Request` de Express. Fix: `canActivate()` retorna
   `true` de inmediato si `context.getType() === 'ws'` (la autenticación
   real del chatbot la hace `WsJwtGuard`, aplicado explícito en el
   gateway).
3. **El manejador de excepciones WS por defecto de Nest no desempaca
   `HttpException`**: un guard reusado de HTTP (`LimitePlanGratisGuard`,
   que lanza `ForbiddenException`) llegaba al cliente WS como un genérico
   `"Internal server error"`, perdiendo el `errorCode`/mensaje real. Fix:
   `WsExceptionsFilter` (mismo criterio que `AllExceptionsFilter`, mismo
   i18n por `errorCode`) aplicado con `@UseFilters()` en el handler del
   gateway, emite un evento `error-chatbot` con la forma estándar
   `{statusCode, errorCode, message}`.

También se corrigió, de paso, un bug preexistente descubierto al
extender el guard para WebSocket: `LimitePlanGratisGuard` nunca llamaba
en realidad a `I18nService.translate()` pese a que la tarjeta de i18n
backend decía que sí — usaba un objeto estático hardcodeado. Ya traduce
de verdad (`errores.LIMITE_PLAN_*` en `es`/`en`).

### Cambio de proveedor: Google Gemini → Groq (Gemini quedó descartado por completo)
Gemini fue el primer proveedor integrado y quedó completamente bloqueado
a nivel de **proyecto de Google Cloud**, no de una API key puntual:
- Todo modelo 2.x (`gemini-2.5-flash`, `gemini-2.0-flash`, ...) → `404
  NOT_FOUND`, *"is no longer available to new users... use
  models/gemini-3.6-flash"*.
- Todo modelo 3.x (`gemini-3.6-flash`, `gemini-3.5-flash`,
  `gemini-flash-latest`, `gemini-pro-latest`, ...) → `403
  PERMISSION_DENIED`, *"Your project has been denied access. Please
  contact support."*
- **Confirmado con DOS API keys distintas** generadas desde cero en el
  mismo proyecto de Google Cloud, mismo resultado exacto en ambas — esto
  descarta que fuera una key individual corrupta o mal generada; es la
  cuenta/proyecto la que está bloqueada.

El equipo decidió no esperar un ticket de soporte de Google sin fecha
resuelta y cambió a **Groq** de forma definitiva. Gracias a que
`LlmClient` ya estaba desacoplado del proveedor, el cambio fue: escribir
`GroqLlmClient` (nuevo), borrar `GeminiLlmClient` (ya no se usa ni se
piensa volver a él), y cambiar un `useClass` en `ChatbotModule` — cero
cambios en `ChatbotService`, `ChatbotGateway`, los guards, ni los tests
de esas piezas.

**Segunda lección de "no confíes en el nombre de modelo de memoria/de un
tercero, verifica contra la API real"**: el modelo que Groq recomendó
inicialmente (`llama-3.3-70b-versatile`) devolvió `model_not_found` real
contra la API — ya no existe en el catálogo actual de Groq para esta key
(su catálogo de modelos cambia con frecuencia). Se resolvió llamando
directo a `GET https://api.groq.com/openai/v1/models` con la key real
del proyecto para ver el catálogo vigente, y probando candidatos de chat
reales hasta confirmar uno que respondiera 200: `openai/gpt-oss-20b`
(20B, el más chico/rápido de la familia `gpt-oss` disponible, ideal para
una capa de ayuda que no necesita el modelo más grande).

### Verificado de punta a punta contra el servidor real (dos veces: fallando con Gemini, respondiendo con Groq)
Con negocios y usuarios reales (registrados vía `/auth/registro`, no
seed) y un script real de `socket.io-client` contra `ws://localhost:3000/chatbot`:
- Conexión + autenticación JWT real sobre WebSocket: ✅.
- Los 3 bugs de guards/filtros HTTP-only de abajo: reproducidos primero,
  arreglados, y re-verificados hasta que la conexión funcionó sin
  crashear (esto pasó ANTES del cambio de proveedor, con Gemini, y sigue
  aplicando igual con Groq — son bugs de transporte, no de proveedor).
- **Con Gemini bloqueado**: el chatbot se degradó correctamente al
  mensaje amable en cada turno, confirmando el camino de fallback real,
  no solo mockeado.
- **Con Groq ya integrado, una conversación real completa**: pregunta
  "¿Qué es Turnify y qué límites tiene el Plan Gratis en servicios
  activos?" → respuesta real generada y transmitida en streaming por
  `respuesta-chunk`, contenido correcto (mencionó el límite real de 3
  servicios activos del Plan Gratis, leído del contexto que arma
  `ChatbotService`, no inventado).
- **Límite freemium de 10 mensajes/día verificado con Groq real**: los
  mensajes se procesan normalmente, el 11vo se bloquea con
  `{"statusCode":403,"errorCode":"LIMITE_PLAN_ALCANZADO","message":"El Plan Gratis permite hasta 10 mensajes al chatbot por día..."}`
  — el mensaje real que devuelve el servidor, no un mock.
- Cada turno (pregunta + respuesta real) se confirmó persistido en
  `mensajes_chatbot` vía el log de queries reales de TypeORM.
- Negocios/usuarios de prueba limpiados al final de cada ronda (`DELETE
  /negocios/mi-negocio`, soft-delete) — no queda basura de prueba en el
  Supabase real del equipo.

- 19 tests unitarios nuevos: `ChatbotService` (incluye no-filtración de
  PII de cliente al prompt), `GroqLlmClient` (`vi.mock('openai', ...)`,
  mismo patrón que `StripeService`), `WsJwtGuard`, `WsExceptionsFilter`,
  `AppThrottlerGuard`, y la extensión de
  `LimitesPlanService`/`LimitePlanGratisGuard` para `mensajesChatbot` +
  contexto WebSocket.

## Frontend: Landing pública conectada a datos reales de planes ✅
Primera tarjeta de Frontend "después del Seguimiento #2" — Backend ya
100% cerrado (ver abajo). Landing pública en `/`, con hero, sección de
características y sección de planes.

- **"/" ahora es dual-purpose según sesión** (punto 6 del brief: "Landing
  pública → Login/Registro → Dashboard"): nuevo componente `Raiz` en
  `App.tsx` que muestra `LandingPage` si no hay sesión, `InicioPage`
  (Dashboard) si la hay — antes `/` siempre exigía sesión vía
  `RutaProtegida` y redirigía a `/login`, lo que dejaba a Turnify sin
  ninguna pantalla pública de verdad. `RutaProtegida` sigue igual para
  `/calendario` y `/onboarding`. Spinner de "restaurando sesión"
  extraído a `PantallaCargando` (compartido entre `RutaProtegida` y
  `Raiz`, antes duplicado).
- **"Datos reales de planes"**: nuevo endpoint público
  `GET /suscripciones/planes` (`@Public()`, sin JWT) en el backend —
  `SuscripcionesService.obtenerLimitesPlanes()` lee los números
  directo de `LimitesPlanService.limite(...)`, la MISMA fuente que usa
  `LimitePlanGratisGuard` para bloquear en producción. La landing nunca
  puede mostrar un número de marketing desactualizado respecto a lo que
  el sistema aplica de verdad — si el equipo cambia un límite en
  `LimitesPlanService`, la landing lo refleja sin tocarla. El Plan de
  Pago no tiene techo numérico en el código (la ausencia de límite ES la
  implementación), así que el frontend lo presenta como "ilimitado" en
  vez de inventar un número.
  - Frontend: `lib/suscripciones-api.ts` (`obtenerPlanes()`, llamada sin
    autenticación) + `useQuery` en `LandingPage`, con `SkeletonText`
    mientras carga (punto 7: nunca un spinner genérico) y un mensaje de
    error si la llamada falla — nunca bloquea el resto de la página.
- **Diseño** (punto 7 del brief): secciones con reveal al hacer scroll
  vía `framer-motion` (`whileInView` + `viewport={{once:true}}` — logra
  el mismo efecto que Intersection Observer manual sin código adicional,
  y hereda `reducedMotion="user"` ya configurado en `main.tsx`, así que
  respeta `prefers-reduced-motion` sin trabajo extra), tarjetas de
  características con stagger, y las mismas tokens de diseño
  (`primary`/`secondary`, radios) que el resto de la app — cero estilos
  nuevos inventados.
- **Bug real encontrado y arreglado antes de cerrar la tarjeta**: los
  botones de la landing eran `<Boton>` (un `motion.button`) anidados
  DENTRO de un `<Link>` de React Router (que renderiza un `<a>`) —
  `<button>` dentro de `<a>` es HTML inválido (contenido interactivo
  anidado) y, verificado en un Chrome real, el click con mouse dejaba de
  disparar la navegación de forma consistente (un `.click()) programático
  sí navegaba, confirmando que el anidado inválido era la causa, no un
  problema de React Router). Fix: los 5 botones de CTA ahora usan
  `useNavigate()` + `onClick` directo sobre el propio `Boton` — mismo
  patrón que ya usaba `InicioPage` para su botón "Ver calendario"; el
  `<Link>` de texto plano del header ("Iniciar sesión") se dejó igual,
  porque ahí sí es un enlace de texto normal, no un botón.
- **Verificado en un Chrome real, no solo con el build**: hero, sección
  de características (con la animación de scroll-reveal disparando) y
  sección de planes con los NÚMEROS REALES devueltos por el backend (1
  usuario / 3 servicios / 20 reservas por mes / 10 mensajes de chatbot
  por día) — confirmado que sin sesión `/` muestra la Landing, con sesión
  (login real contra el backend) `/` muestra el Dashboard, y al cerrar
  sesión vuelve a la Landing. Sin errores en consola.
  - **Limitación de esta verificación**: la herramienta de automatización
    del navegador de esta sesión tuvo fallos intermitentes propios (no de
    la app) — timeouts de captura de pantalla, `resize_window` sin
    efecto real en el viewport, y clicks/tecleo por coordenadas del mouse
    que no se registraban. Se compensó disparando eventos reales del DOM
    vía JavaScript (`input`/`click`/`requestSubmit()`) para confirmar el
    comportamiento, y las capturas de pantalla que sí funcionaron
    confirman el render visual — pero **la vista mobile/responsive de
    esta pantalla específica no se pudo capturar visualmente esta
    sesión** (las clases responsive de Tailwind son las mismas
    convenciones `sm:`/`lg:` ya usadas y verificadas en Login/Registro/
    Onboarding, pero eso no es lo mismo que haberlo visto en mobile).

## Frontend: Dashboard con KPIs desde el módulo Reportes ✅
`InicioPage` (la home autenticada, en `/`) deja de ser el placeholder
"Bienvenido + botón a Calendario" y pasa a ser el Dashboard real que pide
punto 6 del brief, con datos reales del mes calendario en curso —
ninguna cifra hardcodeada.

- **KPIs reales desde `GET /reportes/resumen`** (`lib/reportes-api.ts`,
  nuevo): Reservas este mes (suma de `reservasPorEstado`), Confirmadas,
  Canceladas, Ingresos estimados (formateado con
  `Intl.NumberFormat('es-CR', {currency:'CRC'})`) — `desde`/`hasta` se
  calculan como el mes calendario completo en UTC (mismo criterio que
  usa el backend para el límite de 20 reservas/mes del Plan Gratis, para
  que el número del Dashboard y el límite que aplica el sistema hablen
  del mismo período).
- **Badge de plan** (requisito explícito del punto 5: *"Plan Gratis"/
  "Plan Pago" en el Dashboard del admin*): `negociosApi.obtenerMiNegocio()`
  ganó el campo `planSuscripcion` (ya lo devolvía el backend, el tipo del
  frontend no lo tenía declarado) y el Dashboard lo pinta como badge real,
  no decorativo.
- **Gráfico de reservas por día**: barras simples con `framer-motion`
  (altura animada, escala por el día con más reservas del mes) — sin
  librería de gráficos nueva, esa se reserva a propósito para la tarjeta
  futura "Pantalla de Reportes con gráficos de datos reales", que sí la
  necesitará para vistas más completas.
- **Estados de carga y vacío** (punto 7): `SkeletonCard` mientras cargan
  los KPIs (nunca un spinner genérico), y un empty state diseñado
  (ícono + mensaje + link a Calendario) cuando el negocio no tiene
  reservas todavía en el mes, en vez de KPIs en cero sin contexto.
- **Verificado en un Chrome real con datos reales, no solo con ceros**:
  con la cuenta demo (`admin@turnify.app`) primero se confirmó el estado
  vacío real (0 en las 4 tarjetas, empty state del gráfico). Después se
  creó una disponibilidad temporal + 2 reservas reales por API (una
  confirmada, ₡8000; una cancelada, ₡12000) para confirmar que los KPIs
  cambian con datos reales: "Reservas este mes: 2", "Confirmadas: 1",
  "Canceladas: 1", "Ingresos estimados: ₡8 000" (la cancelada NO se
  contó, tal como filtra `ReportesService.sumarIngresosEstimados`) — y
  que el gráfico de barras sí dibuja con datos reales. Disponibilidad y
  reservas de prueba limpiadas al final (reservas canceladas —no hay
  borrado físico en la API—, disponibilidad eliminada).
- Un ajuste visual real detectado en esa misma verificación: con un solo
  día de datos, la barra (antes `flex-1`) se estiraba a todo el ancho del
  contenedor pareciendo un bloque sólido en vez de una barra — se le puso
  un ancho fijo angosto (`w-3`, `max-w-6`) para que se vea como una barra
  incluso con pocos días de datos.

## Frontend: Wizard de reserva pública (4 pasos) ✅
Backend nuevo + frontend, cerrados juntos: no existía NINGÚN endpoint sin
sesión para que un cliente final reserve — todo `/reservas` exigía JWT
(`ReservasController` lo dice explícito en su propio comentario). Esta
tarjeta construyó esa superficie pública desde cero.

- **Backend — módulo nuevo `ReservaPublicaModule`** (`/publico/negocios/:idNegocio/...`,
  todo `@Public()`): `GET /` (nombre/tipo del negocio), `GET /servicios`,
  `GET /horarios?idServicio&fecha`, `POST /reservas`. En vez de duplicar
  la lógica de disponibilidad/traslapes/notificaciones ya construida en
  `ReservasService`, cada método abre un `TenantContextService.run(...)`
  **sintético** para el `idNegocio` de la URL (nunca de un JWT, que aquí
  no existe) y adentro reutiliza `NegociosService`/`ServiciosService`/
  `ClientesService`/`ReservasService` tal cual los usaría un admin — así
  ninguna regla de negocio puede desincronizarse entre el flujo interno
  y el público.
  - Cálculo real de horarios disponibles (nuevo, no existía): cruza
    `Disponibilidad` (por día de la semana, hora local CR) con
    `Reserva` no cancelada del día, genera slots espaciados por la
    duración del servicio, y solo cuenta un horario si ALGÚN usuario
    activo está libre — el wizard nunca pide elegir empleado (no es uno
    de los 4 pasos del brief), así que el backend asigna uno disponible
    automáticamente al confirmar (re-verificado en ese momento, nunca
    confía en el cálculo de la lista).
  - Find-or-create de `Cliente` por correo (`ClientesService.buscarPorCorreo`,
    nuevo) — un visitante que reserva dos veces con el mismo correo no
    duplica su ficha de cliente.
  - **Límite freemium replicado, no salteado**: `POST /reservas` no pasa
    por `LimitePlanGratisGuard` (depende de `request.user`, inexistente
    aquí) — el service llama `LimitesPlanService` directo con el mismo
    criterio, mismo `errorCode`, mismo i18n.
  - Rate limit propio más estricto (10/min) en el POST — punto 15 del
    brief lo pide explícito para el endpoint de reserva pública.
  - Nuevas utilidades de zona horaria (`inicioDeDiaLocalCR`,
    `horaMinutoADate`) en `zona-horaria-negocio.ts`, inversas de la ya
    existente `aMomentoLocalCR` — mismo archivo, no un cálculo de offset
    duplicado en otro lugar.
  - 8 tests unitarios nuevos (`reserva-publica.service.spec.ts`).
  - **Verificado contra el servidor real** (no solo unit tests): negocio
    demo real, disponibilidad real creada por API, servicio real →
    `GET /servicios` y `GET /horarios` devolvieron datos reales; `POST
    /reservas` creó una reserva real con `origen: "online"`; el horario
    recién tomado desapareció de `GET /horarios` en la siguiente
    consulta; reservar el mismo horario otra vez devolvió 404
    `HORARIO_NO_DISPONIBLE`; reservar de nuevo con el mismo correo
    reusó el mismo `idCliente` (find-or-create confirmado). Datos de
    prueba limpiados al final.
- **Frontend — `ReservaPublicaPage`** (`/reservar/:idNegocio`, pública,
  fuera de `RutaProtegida`): los 4 pasos exactos del punto 6 del brief
  (Servicio → Horario → Datos del cliente → Confirmación), con
  indicador de progreso, Skeletons mientras cargan servicios/horarios
  (nunca spinners), animación de confirmación (check animado, punto 7),
  y manejo de error real si el horario ya se lo llevaron entre que el
  cliente lo vio y confirmó.
- **Bug real encontrado y arreglado — el más serio de la sesión hasta
  ahora**: `AnimatePresence mode="wait"` (Framer Motion) para animar la
  transición entre pasos dejaba el wizard **completamente congelado en
  el paso 1** — confirmado con evidencia sólida, no una sospecha: logs
  de render mostraban `paso=2` con el estado de React ya actualizado
  correctamente tras el click, pero el DOM seguía mostrando el contenido
  del paso 1 indefinidamente (`AnimatePresence` nunca completaba la
  animación de salida y por eso nunca montaba el paso entrante, en modo
  `"wait"`). Fix: se quitó `AnimatePresence` de la transición entre pasos
  (innecesaria para la corrección funcional) y se dejó una animación de
  entrada simple (`initial`/`animate` con `key` por paso, sin `exit`) —
  sacrifica la animación de salida pero el wizard avanza de verdad, que
  es lo que importa. Encontrado y arreglado ANTES de comitear, verificando
  con clicks reales disparados por JavaScript (no solo capturas de
  pantalla) hasta confirmar que el paso 4 (confirmación real, con
  reserva creada en Postgres) se alcanzaba.
- **Verificado de punta a punta en un Chrome real** los 4 pasos
  completos: selección de "Corte clásico" → fecha de hoy con horarios
  reales (08:00–17:30 cada 30 min, según la disponibilidad real creada)
  → selección de las 10:00 a.m. → formulario de datos del cliente →
  pantalla de confirmación con el resumen correcto (servicio, fecha/hora
  en español, precio, nombre, correo) → clic en "Confirmar reserva" →
  pantalla de éxito animada con el check, mismo resumen, y "Volver al
  inicio". Reserva de prueba y cliente de prueba limpiados al final
  (cancelada / desactivado) — no queda basura en el Supabase real del
  equipo.

## Modo autónomo nocturno (instrucción del equipo, sin pedir confirmación entre tarjetas)
El equipo pidió continuar TODAS las tarjetas de Frontend restantes en el
orden exacto de docs/spec.md, una tras otra, sin pausar a preguntar,
repartiendo el token budget restante entre las tareas, y deteniéndose
limpio (comiteado + esta nota actualizada) en el límite entre dos
tarjetas si el contexto se agota antes de terminar todas. Esta sesión
sigue ese modo desde el Wizard de reserva pública en adelante. Orden
exacto acordado con el equipo para el resto de la noche:

Notificaciones (pantalla) → Reportes (pantalla con gráficos) → Selector
de idioma → Responsive → Toggle lista/cuadrícula → Dark mode → Pantalla
de upgrade de plan → Marcar nivel_cliente → Widget de chatbot flotante.

Si esta sesión se corta a mitad de la lista: seguir exactamente en ese
orden desde la tarjeta que NO tenga su propio "✅" y su propia sección
en este archivo — cada tarjeta cerrada de verdad deja su commit +
sección aquí, igual que todas las anteriores.

## Frontend: Pantalla de Notificaciones (historial + configuración de recordatorios) ✅
Backend nuevo (no existía ningún endpoint HTTP para Notificacion — el
módulo era 100% interno, solo el worker/cron la usaba) + frontend,
cerrados juntos.

- **Backend**: `GET /notificaciones` (nuevo `NotificacionesController`),
  paginado, historial del negocio actual. `Notificacion` no tiene
  `idNegocio` propio (se deriva de `id_cliente`/`id_reserva`, ya
  documentado así desde el Worker) — el nuevo `NotificacionesService.listar()`
  filtra con un join contra `Cliente` (que sí lo tiene), mismo criterio
  que el resto del servicio para esta entidad. 1 test unitario nuevo.
- **"Configuración de recordatorios"**: la ER (punto 1 del brief, "ya
  validado, implementar tal cual") no tiene ningún campo para configurar
  horas de anticipación de un recordatorio, y el propio cron que
  dispararía un `RECORDATORIO` real nunca se construyó (anotado como
  mejora futura desde la tarjeta del Worker de Notificaciones) — inventar
  una columna nueva o un cron nuevo en medio de esta tarjeta de frontend
  se sintió como alcance no pedido. Se interpretó "configuración" de
  forma honesta con lo que SÍ es real hoy: un panel que muestra qué
  canales están disponibles para recordar — Email (siempre) y WhatsApp
  (leído de `negocio.planSuscripcion`, el MISMO campo y la MISMA regla
  que ya aplica `PrivilegioClienteGuard` en el backend) — en vez de un
  toggle decorativo que no hiciera nada de verdad.
- **Frontend — `NotificacionesPage`** (`/notificaciones`, protegida,
  nuevo link en `AppLayout`): tabla con cliente/tipo/canal/estado/fecha,
  badges de estado con color real (verde enviada, ámbar pendiente, rojo
  fallida), paginación, `SkeletonTable` mientras carga, empty state
  diseñado.
- **Verificado en un Chrome real con datos reales** (no seed, historial
  real de las reservas de prueba creadas/canceladas esta misma noche
  durante la verificación del Wizard): 4 notificaciones reales
  (Confirmación/Cancelación, canal email, estado "fallida" — Resend en
  este entorno de desarrollo no tiene un dominio verificado, documentado
  desde la tarjeta original del Worker, no es un bug de esta pantalla),
  con nombres de cliente y fechas reales correctamente formateadas en
  hora de Costa Rica. Panel de canales mostró correctamente WhatsApp
  bloqueado (negocio demo en Plan Gratis) — apagado visualmente y con el
  mensaje real de por qué. Sin errores de consola.

## Frontend: Pantalla de Reportes con gráficos de datos reales ✅
Reusa el mismo `GET /reportes/resumen` del Dashboard (sin cambios de
backend) — la diferencia con la tarjeta del Dashboard es que aquí sí van
los gráficos de verdad que pide el punto 6 del brief.

- **Librería nueva**: `recharts@3.10.1` (peer deps declaran soporte
  React 19 explícito, verificado antes de instalar). Es la primera
  dependencia de gráficos del proyecto — el Dashboard usó barras CSS a
  propósito para no anticipar esta dependencia antes de que existiera
  una tarjeta que la pidiera.
- **Selector de período real** (Este mes / Mes pasado / Últimos 3 meses)
  que recalcula `desde`/`hasta` y vuelve a pedir el resumen — no un
  filtro decorativo.
- **Gráfico de barras** (reservas por día) y **gráfico de dona**
  (reservas por estado, con los mismos colores que ya usa el Dashboard/
  Calendario para cada estado) — ambos con estado vacío diseñado si el
  período no tiene datos.
- **Exportar CSV, gated por el plan** (punto 5.1 del brief: *"Reportes
  básicos, sin exportación de datos"* en el Plan Gratis): botón
  deshabilitado + texto explicando por qué si `negocio.planSuscripcion === 'gratis'`,
  generación de CSV 100% en el cliente (Blob + `<a download>`) a partir
  de los datos ya cargados — no requirió tocar el backend.
- **Verificado en un Chrome real con datos reales** (el mismo historial
  de pruebas de esta noche: 5 reservas, todas canceladas): KPIs
  correctos (5 reservas totales, ₡0 ingresos estimados, 100% tasa de
  cancelación — coincide con que ninguna quedó confirmada), barras
  reales para los días 19 y 26 de septiembre (las fechas reales de las
  pruebas), dona con la porción "Cancelada" completa, cambio de período
  a "Últimos 3 meses" recalculó correctamente, botón Exportar
  deshabilitado con el mensaje correcto (negocio demo en Plan Gratis).
  Sin errores de consola.

## Frontend: Selector de idioma (react-i18next, ES/EN) ✅
Infraestructura real de i18n del frontend (punto 10 del brief), más
traducción completa de las dos pantallas que el brief exige
explícitamente para esta tarjeta.

- **`react-i18next@16.2.0` + `i18next@26.4.2` + `i18next-browser-languagedetector@8.2.1`**
  (peer deps de `react-i18next` verificadas para React 19 antes de
  instalar). `src/i18n/config.ts` inicializa con español por defecto
  (mercado objetivo Costa Rica) y detección en este orden: preferencia
  guardada en `localStorage` (`turnify_idioma`) primero, idioma del
  navegador después — para que la elección explícita del usuario nunca
  se pierda ni la pise el navegador en la siguiente visita.
- **`ControlesGlobales`** (nuevo, `components/layout/`): el selector
  ES/EN en sí, diseñado a propósito como el contenedor donde van a vivir
  también el toggle de tema y el de vista lista/cuadrícula cuando se
  construyan (punto 9 del brief: *"un solo grupo de componentes desde el
  principio, no ajustes sueltos agregados después"*) — ya está montado
  en el navbar de `LandingPage` y de `AppLayout` (visible entonces en
  TODAS las pantallas autenticadas, no solo Dashboard, superando el
  mínimo del brief que solo pide "landing y dashboard").
- **Alcance honesto de la traducción de contenido**: el brief pide el
  selector visible en "landing y dashboard" — se tradujeron esas dos
  pantallas por completo (`es.json`/`en.json`, con interpolación real
  para los números de plan del backend y el mes del Dashboard) más las
  etiquetas de navegación compartidas (`AppLayout`). El resto de
  pantallas construidas en sesiones anteriores y esta misma noche
  (Login, Registro, Onboarding, Calendario, Notificaciones, Reportes,
  Wizard de reserva pública) siguen con texto fijo en español — no se
  retrofitó el proyecto completo en esta tarjeta para no comerse el
  presupuesto de las tarjetas que faltan esta noche; queda anotado como
  trabajo incremental real, no como "ya hecho".
- **Verificado en un Chrome real cambiando de idioma de verdad**:
  Dashboard con sesión real → clic en EN → título, badge de plan, las 4
  tarjetas KPI y el nombre del mes cambiaron a inglés al instante;
  `localStorage.getItem('turnify_idioma')` confirmado en `'en'`; cierre
  de sesión y recarga de la Landing (sin sesión) → la preferencia
  persistió y la Landing completa (hero, características, ambos planes
  con los límites reales interpolados, footer) se mostró en inglés
  correctamente; vuelto a español al terminar. Sin errores de consola en
  ningún punto.

## Frontend: Ajustes responsive/mobile-first en todo el sistema ✅
Auditoría real de código (no solo visual) de todas las pantallas
construidas hasta ahora, más un bug real encontrado y arreglado en el
camino que no tiene nada que ver con "responsive" pero salió a la luz
verificando esta misma tarjeta.

- **Limitación de herramienta, resuelta con otro método**: `resize_window`
  seguía sin cambiar `window.innerWidth` real en este entorno (confirmado
  de nuevo, dos veces, con pestañas nuevas) — en vez de insistir, se hizo
  una auditoría de código dirigida: cálculo manual del ancho combinado de
  cada fila de controles a 390px (el ancho de referencia mobile del
  punto 12), `grep` sistemático de grids/tablas/anchos fijos en todo
  `src/pages` y `src/components`, y verificación real en Chrome de que
  los fixes no rompieran nada en desktop (única resolución que la
  herramienta sí permite esta noche).
- **3 desbordes horizontales reales encontrados y arreglados** (los tres
  por el mismo patrón: varios elementos en una fila `flex` sin
  `flex-wrap` ni `min-w-0`, cuyo ancho combinado excede 390px):
  1. **Navbar de `AppLayout`** (Turnify + 3 links + selector de idioma +
     nombre + logout): el ancho combinado del lado izquierdo YA superaba
     390px él solo. Fix: `<nav>` propio con `overflow-x-auto` + `min-w-0`
     en ambos contenedores flex (sin `min-w-0` un hijo de flexbox nunca
     se encoge más allá de su contenido — la causa real de que
     `overflow-x-auto` no hiciera nada antes de este fix) — la tira de
     links ahora puede hacer su propio scroll horizontal si hiciera
     falta, sin que el header entero se desborde.
  2. **Navbar de `LandingPage`**: "Turnify" + selector ES/EN + "Iniciar
     sesión" + botón "Registrar mi negocio" completo no cabían juntos en
     390px. Fix: el botón muestra un texto abreviado ("Registrarse"/
     "Sign up", nueva clave `comun.registrarse` en ambos idiomas) por
     debajo de `sm:`, con el texto completo intacto en desktop.
  3. **Selector de período de `ReportesPage`**: la fila de 3 botones de
     período + botón Exportar podía desbordarse en el punto justo entre
     "cabe" y "no cabe". Fix: `flex-wrap` en ambos contenedores para que
     se acomoden en una segunda línea en vez de desbordar, sin cambiar
     nada en desktop.
- **Toolbar de FullCalendar (Calendario) simplificado en mobile**: el
  header de FullCalendar no envuelve sus propios botones — con los 3
  grupos completos (nav + título + selector de vista) se arriesgaba a
  desbordarse en pantallas angostas. Como la vista ya cambiaba sola según
  el ancho (código ya existente de una sesión anterior), el selector de
  vista es redundante en mobile: se quita ahí (`TOOLBAR_MOBILE` vs
  `TOOLBAR_DESKTOP`, aplicado tanto al montar como en el listener de
  resize que ya existía).
- **Bug real encontrado sin buscarlo, verificando el Calendario en un
  Chrome real durante esta tarjeta**: el Calendario se rompía por
  completo (pantalla en blanco) para cualquier reserva cuyo cliente
  hubiera sido desactivado después — `TypeError: Cannot read properties
  of null (reading 'nombreCompleto')`. Causa raíz real: `ReservasService.listar()`/`obtenerUna()`
  piden las relaciones `cliente`/`servicio`/`usuario` sin `withDeleted`,
  y TypeORM excluye por defecto las filas con soft-delete de un join —
  cualquier reserva (nunca se borra, es historial permanente) que
  referenciara un cliente ya desactivado llegaba con `cliente: null` al
  frontend. Fix en dos capas: `withDeleted: true` en ambas consultas del
  backend (2 tests nuevos que lo confirman) para que el historial nunca
  pierda esas relaciones, más `?.` defensivo en `CalendarioPage` como red
  de seguridad adicional (nunca romper toda la pantalla por un dato
  faltante). Encontrado con datos de prueba reales de esta misma noche
  (un cliente que se había desactivado durante la limpieza del Wizard de
  reserva pública) — no un caso inventado.
- **Verificado en un Chrome real** (a la resolución de escritorio
  disponible, la limitación de la herramienta ya documentada): Landing,
  Dashboard y Calendario renderizan sin regresiones tras los cambios, el
  botón "Registrar mi negocio" muestra el texto completo en desktop como
  antes, y el Calendario carga y responde a clicks en eventos
  correctamente después del fix de `withDeleted`. Sin errores de consola
  en ningún caso (confirmado limpiando el buffer de consola y navegando
  de nuevo, no solo leyendo mensajes viejos).

## Frontend: Toggle de vista lista/cuadrícula reutilizable (Clientes, Servicios, Reservas) ✅
El punto 9 del brief pedía el toggle en 3 pantallas administrativas que
**todavía no existían** (`ls src/pages` confirmó que no había
`ClientesPage`/`ServiciosPage`/`ReservasPage` antes de esta tarjeta) —
así que la tarjeta terminó siendo "construir las 3 pantallas admin
completas" y no solo "agregar un toggle a algo ya construido". Backend
no necesitó cambios: `GET/POST/PATCH/DELETE /clientes` y `/servicios` y
`GET /reservas` (+ `/cancelar`) ya existían y se reusaron tal cual.

- **`useVistaPreferida(clave)`** (`lib/vista-preferida.ts`): hook
  genérico, localStorage-backed, con una clave POR PANTALLA
  (`turnify_vista_clientes`/`_servicios`/`_reservas`) — mismo patrón que
  ya se usaba para la preferencia de idioma.
- **`<ToggleVista>`** (`components/ui/ToggleVista.tsx`): el único
  componente de toggle grid/lista para las 3 pantallas, con
  `aria-pressed` por botón (punto 10, accesibilidad) — nunca reinventado
  por pantalla.
- **`ClientesPage`** (`/clientes`, nueva): CRUD completo (crear/editar
  vía `Modal`+react-hook-form+zod, desactivar vía `ConfirmDialog`),
  badges de nivel (Gratis/Premium) y canal preferido, vista
  cuadrícula/lista con `ToggleVista`. `clientes-api.ts` nuevo.
- **`ServiciosPage`** (`/servicios`, nueva): mismo patrón CRUD;
  `servicios-api.ts` extendido con `listar`/`actualizar`/`desactivar`
  (antes solo tenía `crear`). Validación de `duracionMinutos`
  (1-1440, entero) y `precio` (`positive()`) alineada exactamente con
  `CrearServicioDto` del backend (`IsInt/Min/Max`, `IsPositive`), no
  límites inventados en el frontend.
- **`ReservasPage`** (`/reservas`, nueva): vista ADMINISTRATIVA de
  reservas (punto 9 la distingue explícitamente del Calendario), de solo
  lectura + cancelar, con filtro por estado y el mismo `ToggleVista`.
  `reservas-api.ts` existente se extendió (`page`, `estado` opcionales
  en `listar()`, antes solo soportaba `desde`/`hasta`/`idUsuario`) sin
  tocar su uso ya existente en `CalendarioPage`.
- Rutas nuevas en `App.tsx` (las 3 envueltas en `RutaProtegida`) y links
  nuevos en el nav de `AppLayout` (+ claves i18n `comun.clientes`/
  `servicios`/`reservas` en es.json/en.json).
- `tsc -b`, `eslint`, `npm run build` y `prettier --write` limpios en
  todos los archivos nuevos/tocados.

**Verificado de verdad en Chrome real, contra el backend real (no
mocks), con la cuenta demo (`admin@turnify.app`) — Clientes y
Servicios:**
- Clientes: login real → `/clientes` carga los 2 clientes reales del
  seed en vista cuadrícula; toggle a lista (persistencia confirmada
  leyendo `localStorage.getItem('turnify_vista_clientes') === 'lista'`
  tras recargar el estado); crear "Cliente E2E Verificación" real (POST
  201, aparece en la lista); editar y poner canal WhatsApp + nivel
  Premium → **bloqueado por el backend real** con el mensaje exacto de
  `PrivilegiosClienteService` ("El plan actual del negocio no tiene el
  canal WhatsApp habilitado" — el negocio demo está en Plan Gratis, la
  regla de dependencia del punto 5 funcionando de punta a punta, no
  simulada); revertir a canal correo → guarda bien ("Cliente
  actualizado"); desactivar → soft-delete real confirmado (desaparece de
  la lista activa, toast "Cliente desactivado").
- Servicios: `/servicios` carga los 3 servicios reales del seed (Corte
  clásico, Corte + barba, Afeitado clásico) con su color/duración/precio
  correctos; intentar crear un 4to servicio activo → **bloqueado por
  `LimitePlanGratisGuard` real** (el negocio demo ya tiene exactamente 3
  servicios activos = el límite del Plan Gratis), con el mensaje real
  del backend tanto en el toast como en el banner ámbar dentro del modal
  ("El Plan Gratis permite hasta 3 servicios activos..."). No se forzó
  la creación (habría requerido desactivar un servicio real del seed).
- Sin errores de consola en ninguna de las dos pantallas.
- **Reservas** (verificado tras retomar la sesión, límite de tokens de
  5h restablecido): `/reservas` carga las 5 reservas reales que quedaron
  de pruebas de sesiones anteriores (todas `Cancelada`, del Wizard/
  reserva pública), en vista cuadrícula con cliente/servicio/fecha/
  estado/usuario correctos; toggle a lista funciona y persiste
  (`turnify_vista_reservas === 'lista'`); filtro por `estado`
  confirmado en ambos sentidos — "Pendiente" muestra el estado vacío
  correcto ("No hay reservas para este filtro"), "Cancelada" vuelve a
  traer las 5 reales — o sea el query param `estado` sí llega al
  backend y `ListarReservasQueryDto` lo filtra de verdad. Sin errores de
  consola. **Nota de proceso, no de código**: varios clics con
  coordenadas de pantalla fallaron en silencio por un desfase real entre
  el frame de la captura de pantalla (1568px) y el viewport real
  (2048px, con `devicePixelRatio` 0.9375) — una vez detectado, clicar por
  referencia de elemento (`find`/`read_page` + click por `ref`) funcionó
  siempre a la primera; no se tocó nada de la app para "arreglar" esto
  porque no era un bug de la app. No se forzó cancelar una reserva real
  para no generar más ruido en los datos de seed — `reservasApi.cancelar`
  ya estaba verificado en el Calendario en una sesión anterior y es la
  misma función, sin cambios.

## Frontend: Modo oscuro/claro persistente ✅
El punto 9 del brief pedía que el tema aplicara "a TODA la interfaz sin
excepciones", usando siempre los design tokens ya definidos — y la base
ya estaba preparada desde antes (`@custom-variant dark` en `index.css`,
comentario explícito de que esta tarjeta lo activaría) y casi todos los
componentes ya traían su clase `dark:` desde que se construyeron. La
tarjeta terminó siendo sobre todo construir el MECANISMO del toggle, más
un gap real que sí faltaba: FullCalendar.

- **`useTema()`** (`lib/tema.ts`): hook que lee `localStorage
  ('turnify_tema')`, cae a `prefers-color-scheme` la primera vez (nunca
  fuerza claro/oscuro sin que el usuario haya elegido), aplica/quita
  `.dark` en `<html>` y persiste el valor solo cuando el usuario alterna
  el toggle — igual al patrón ya usado para `useVistaPreferida`.
- **Script inline en `index.html`** que aplica `.dark` de forma síncrona
  ANTES de que React monte, leyendo el mismo `localStorage`/
  `prefers-color-scheme` que el hook — evita el parpadeo claro→oscuro en
  la primera pintura (un problema real de cualquier SPA sin SSR, no
  específico de este proyecto).
- **Toggle en `ControlesGlobales`** (sol/luna, mismo estilo de píldora
  que el selector de idioma) — vive en el mismo grupo que idioma,
  visible en Landing y en todas las pantallas autenticadas (vía
  `AppLayout`), igual alcance que el selector de idioma ya tenía. Claves
  i18n nuevas (`comun.cambiarATemaClaro/Oscuro`).
- **Bug/gap real encontrado sin que nadie lo pidiera explícitamente**:
  FullCalendar (Calendario) NO usa las utilidades `dark:` de Tailwind —
  pinta con sus propias variables CSS (`--fc-*`) y se habría quedado con
  fondo blanco/texto oscuro fijo en modo oscuro, la única pantalla que sí
  habría roto el "sin excepciones" del punto 9. Fix: bloque
  `.dark .fc { --fc-border-color: ...; --fc-today-bg-color: ...; ... }`
  en `index.css` redefiniendo las variables de tema de FullCalendar con
  los mismos tokens slate/primary del resto de la app, en vez de pelear
  con `!important` contra sus clases `.fc-*`.
- Auditoría de código para confirmar que no había colores sueltos fuera
  de la paleta slate/primary/secondary (`grep` de `bg-gray-`/`text-gray-`/
  `bg-black` etc. en todo `src` → cero resultados) ni estilos inline con
  colores hardcodeados (cero resultados fuera de `colorCalendario` de
  servicios/reservas, que es un dato de negocio, no un color de tema).

**Verificado en Chrome real, con la cuenta demo:**
- El toggle cambia `<html class="dark">` y `localStorage` de verdad
  (confirmado leyendo el DOM, no asumido); Dashboard, Landing y
  Calendario re-renderizan correctamente en oscuro con buen contraste;
  el highlight de "hoy" y los botones de FullCalendar (mes/semana/
  agenda, prev/next) se ven bien en oscuro gracias al fix de variables.
  Recargar la página con el tema ya guardado en oscuro lo mantiene sin
  parpadeo (confirmado leyendo `document.documentElement.className`
  inmediatamente después de navegar). Volver a claro también funciona.
  Sin errores de consola.
- **Nota de proceso, no de código**: el `computer` tool (clic por
  coordenadas de pantalla) volvió a fallar en silencio contra el botón
  de 28×28px del toggle de tema, un par de veces seguidas, por el mismo
  desfase de escala ya documentado en la verificación de Reservas
  (viewport 2048px vs. captura de pantalla 1568px). Se confirmó que el
  botón y su `onClick` de React eran correctos disparando un click real
  vía `el.click()` en la página (equivalente a un clic de usuario real,
  no un mock) — mismo resultado que clicar por referencia de elemento.

## Frontend: Pantalla/banner de upgrade de plan (Plan Gratis → Plan de Pago) ✅
El backend de Suscripciones (Stripe Test Mode, checkout + webhook) ya
existía completo de una tarjeta anterior — esta tarjeta era 100%
frontend: exponer ese flujo real al admin.

- **Refactor antes de construir**: la Landing pública ya tenía una
  comparación de planes completa (`ItemPlan` + las dos tarjetas); en vez
  de copiar esas ~90 líneas en la pantalla nueva, se extrajo a
  `components/suscripciones/TarjetasPlanes.tsx` (props `ctaGratis`/
  `ctaPago`/`planActual`) y `LandingPage.tsx` se reescribió para
  consumirlo — una sola fuente para los números reales del Plan Gratis
  (misma query a `GET /suscripciones/planes`) en vez de dos copias que se
  desincronizarían si cambian los límites.
- **`SuscripcionPage`** (`/suscripcion`, nueva): usa `TarjetasPlanes` con
  `planActual` calculado desde `negociosApi.obtenerMiNegocio()`; el CTA
  del Plan de Pago llama `POST /suscripciones/checkout` con las
  `successUrl`/`cancelUrl` reales (`/suscripcion/exito` y
  `/suscripcion/cancelada`, los mismos ejemplos que trae
  `IniciarCheckoutDto`) y redirige el navegador a la URL de Stripe
  Checkout devuelta (`window.location.href`, no un `navigate` de router,
  porque es un dominio externo). El plan activo muestra un botón
  deshabilitado "Tu plan actual" en vez de un CTA — nunca un botón
  accionable sin sentido.
- **`SuscripcionExitoPage`/`SuscripcionCanceladaPage`** (nuevas): las
  pantallas exactas a las que Stripe redirige tras el Checkout;
  éxito invalida las queries de `negocios`/`suscripciones` para que la
  siguiente vista pida el estado fresco (el webhook de Stripe puede
  tardar unos segundos más que el redirect).
- **Banner en el Dashboard** (`InicioPage`, usando el `Banner` compartido
  del punto 8 — no uno inventado ad-hoc): visible solo si
  `planSuscripcion === 'gratis'`, con CTA a `/suscripcion`.
- Link "Suscripción" nuevo en el nav de `AppLayout` + claves i18n nuevas
  (`comun.suscripcion`, namespace `suscripcion.*`, `dashboard.bannerPlanGratis*`).
- `suscripciones-api.ts` extendido con `obtenerMiSuscripcion()` e
  `iniciarCheckout()`.
- `tsc -b`, `eslint`, `npm run build` y `prettier --write` limpios.

**Verificado en Chrome real, con la cuenta demo (Plan Gratis):**
- Dashboard muestra el banner real con el CTA correcto; `/suscripcion`
  carga los límites reales del Plan Gratis (1 usuario/3 servicios/20
  reservas/10 mensajes chatbot — los mismos números que
  `LimitePlanGratisGuard` aplica de verdad) con el badge "Tu plan actual"
  en la tarjeta correcta y "Sin límites" en la de pago.
- Clic real en "Actualizar a Plan de Pago" → llamada real a `POST
  /suscripciones/checkout` → **el backend respondió 503
  `PASARELA_PAGOS_NO_DISPONIBLE`, mostrado tal cual en un toast** ("La
  pasarela de pagos no está disponible en este momento"). Esto es un
  hallazgo real del entorno, no un bug de esta tarjeta: `STRIPE_SECRET_KEY`
  y `STRIPE_WEBHOOK_SECRET` están vacíos en `.env` (confirmado con
  `grep`) — nunca se configuraron credenciales de prueba reales de Stripe
  en este proyecto. El flujo de éxito/degradación se verificó de punta a
  punta contra el backend real hasta el límite que el entorno permite; un
  Stripe Checkout Session real requeriría esas credenciales, que no
  existen aquí — no se puede verificar más allá de esto sin ellas.
- `/suscripcion/exito` y `/suscripcion/cancelada` renderizan su copy
  correcto navegando directo (no se pudo llegar ahí por un Checkout real,
  por el punto anterior).
- Landing pública (sin sesión, `localStorage` limpiado a propósito para
  la prueba) sigue mostrando ambas tarjetas de planes correctamente tras
  el refactor a `TarjetasPlanes` — sin regresión.
- Sin errores de consola en ninguna pantalla.

## Frontend: Marcar/mostrar nivel_cliente (Gratis/Premium) en Clientes ✅ (ya estaba hecho)
Al revisar esta tarjeta contra el código actual, **ya estaba 100%
satisfecha** por `ClientesPage` (construida en la tarjeta del Toggle,
antes de que esta tarjeta empezara formalmente):
- **Marcar**: el formulario de crear/editar tiene un `Select` "Nivel de
  cliente" (Gratis/Premium) — `ClientesPage.tsx` línea ~334-338 —, ya
  verificado en Chrome real durante la tarjeta del Toggle (se cambió un
  cliente de prueba a Premium y se guardó correctamente).
- **Mostrar**: `BadgeNivel` (ámbar "Premium" / slate "Gratis") se
  renderiza tanto en la vista de cuadrícula como en la de lista —
  exactamente lo que pide el punto 5.2 del brief ("Badge visible
  'Cliente Premium'... lista y cuadrícula").
No se necesitó ni una línea de código nueva; se documenta aquí para que
el reporte final la liste como tarjeta cerrada, con honestidad sobre que
el trabajo real ocurrió en la tarjeta anterior.

## Frontend: Widget de chatbot flotante (tiempo real, contextual, responsive) ✅
Última tarjeta del orden acordado. El backend (Gateway WebSocket + Groq)
ya estaba cerrado y verificado de una tarjeta anterior — esta era
puramente la UI del widget que lo consume, sin tocar el backend.

- **`useChatbotSocket(activo)`** (`lib/chatbot-socket.ts`): cliente
  `socket.io-client` (ya estaba en `package.json`, mismo major que el
  servidor `4.8.x`) contra el namespace real `/chatbot` —
  `emit('mensaje', {pregunta, pantallaActual})`, escucha
  `'respuesta-chunk'` (concatena cada fragmento al último mensaje del
  asistente, streaming real token a token, no espera la respuesta
  completa), `'respuesta-fin'` y `'error-chatbot'` (la misma forma
  estándar de error del resto del sistema). Conexión perezosa: el socket
  solo se abre mientras el panel está desplegado.
  - El primer intento de esta tarjeta violaba la regla nueva de ESLint
    `react-hooks/set-state-in-effect` (llamar `setState` de forma
    síncrona en el cuerpo del efecto, antes de cualquier callback
    async) — se corrigió derivando el estado de conexión
    (`inactivo/conectando/conectado/error`) de dos flags booleanos que
    solo cambian dentro de los propios callbacks de eventos del socket
    (`'connect'`/`'connect_error'`/`'disconnect'`), nunca de forma
    síncrona en el efecto.
- **`ChatbotWidget`** (`components/chat/ChatbotWidget.tsx`): botón
  flotante circular (Framer Motion, mismo patrón de `AnimatePresence`
  simple ya usado en `Modal` — sin `mode="wait"`, el que causó el bug
  real de la Wizard en una tarjeta anterior) que despliega un panel de
  chat con burbujas usuario/asistente, indicador de streaming en curso,
  degradación a mensaje de sistema ante `error-chatbot` o fallo de
  conexión (nunca una pantalla rota ni un loading infinito, punto 16 del
  brief), input + botón enviar (Enter para mandar). La pantalla actual
  (vía `useLocation()` de React Router, mapeada a un nombre legible) se
  manda en cada pregunta — el rol del usuario y los datos reales del
  negocio los resuelve el backend a partir del JWT y sus propios
  services, nunca se mandan desde el frontend.
- Montado UNA sola vez en `AppLayout` (punto 16: "no repetido por
  pantalla") — visible en todas las pantallas autenticadas del admin.
- `BASE_URL` de `lib/api.ts` se exportó (antes era un `const` privado)
  para que el socket use el mismo origen que el HTTP, una sola fuente.
- Claves i18n nuevas (namespace `chat.*`).
- `tsc -b`, `eslint` (incluida la regla nueva de hooks) y `npm run
  build` limpios.

**Verificado en Chrome real, contra el Gateway y Groq reales (no
mocks), con la cuenta demo:**
- El botón flotante y el panel abren correctamente; el socket conecta
  de verdad (input habilitado solo tras el evento `'connect'` real).
- **Pregunta real sobre datos reales**: "¿Cuántos servicios activos
  tengo ahora mismo?" → el asistente respondió "Tienes 3 servicios
  activos en este momento" — el número real y correcto del negocio demo
  (Corte clásico, Corte + barba, Afeitado clásico), confirmando que el
  backend reutilizó de verdad el service de Servicios para este tenant
  y no inventó/alucinó la cifra.
- **Contextualización de pantalla real**: navegando a `/clientes` y
  preguntando "¿En qué pantalla estoy ahora mismo?" → el asistente
  respondió "Estás en la pantalla **Clientes** del panel de
  administración de Barbería Demo Turnify..." — acertó tanto la
  pantalla actual (mandada por el frontend) como el nombre real del
  negocio (inyectado por el backend desde el JWT/tenant), cubriendo los
  tres ejes de "Contextualización real" del punto 16 (rol vía JWT,
  pantalla actual, datos reales del negocio).
- Dark mode: el panel completo (burbujas, input, botones) se ve
  correctamente con buen contraste en oscuro — sin colores sueltos que
  se hayan escapado de la auditoría de la tarjeta de Dark mode.
- Sin errores de consola en ninguna prueba.
- **No verificado a propósito**: el límite diario del Plan Gratis
  (`mensajesChatbot`) — forzar 10 mensajes reales solo para ver el
  mismo `error-chatbot` genérico (que ya se probó con el mismo patrón en
  Clientes/Servicios esta sesión) habría gastado cupo real de la API de
  Groq sin aportar una verificación distinta.
- **Gap real, documentado, no resuelto a propósito**: el punto 16 pide
  el widget "tanto para el cliente final (mientras reserva) como para
  el admin", pero `ChatbotGateway` exige JWT (`WsJwtGuard`, sin ruta
  anónima) — el wizard de reserva pública (`ReservaPublicaPage`, sin
  sesión) no puede usar el chatbot real tal como está construido el
  backend. Extender el gateway a un modo anónimo es un cambio de
  backend fuera del alcance de "construir la UI del widget" y no se
  inventó aquí; el widget se montó donde el backend real lo soporta
  (todo el panel autenticado del admin).

## Modo autónomo nocturno — TODO EL FRONTEND CERRADO
Con esta tarjeta se cierran las 10 tarjetas de frontend del orden
acordado (ver "Modo autónomo nocturno" arriba). El reporte final
consolidado se entrega en el mensaje de chat de esta sesión, no aquí —
por instrucción del equipo, un solo reporte al final y no uno por
tarjeta.

## Ronda final: Seguridad + QA (instrucción del equipo tras cerrar Frontend)
Con Backend y Frontend 100% cerrados, el equipo pidió 5 tareas más de
docs/spec.md, una por una, cada una con su propio commit:
1. Rate limiting real del WebSocket del chatbot.
2. QA: test E2E del wizard de reserva pública.
3. QA: prueba de aislamiento multi-tenant específica del chatbot.
4. QA: revisar cobertura de Auth y Reservas de punta a punta.
5. QA: verificar i18n de punta a punta en una pantalla más.

### 1. Rate limiting del WebSocket del chatbot ✅
Gap real: `AppThrottlerGuard` (el throttler HTTP global) salta por
completo cualquier contexto `'ws'` porque `ThrottlerGuard` de
`@nestjs/throttler` asume request/response de Express y revienta con
"res.header is not a function" sobre un socket (bug real ya documentado
de una tarjeta anterior) — eso dejaba el chatbot con un solo control de
abuso real: el tope DIARIO de `mensajesChatbot` (`LimitePlanGratisGuard`),
que no evita una ráfaga de decenas de mensajes en segundos (agotando ese
cupo de un golpe, o saturando la API de Groq sin necesidad).

- **`ChatbotWsThrottlerGuard`** (nuevo, `modules/chatbot/guards/`):
  ventana fija en memoria por socket (5 mensajes / 10 segundos) — más
  simple y explícito que forzar `@nestjs/throttler` a entender
  WebSockets, mismo criterio que los demás guards transversales del
  proyecto (estado propio, sin pelear con una librería pensada para
  HTTP). Excede el límite → `ErrorCodeException('DEMASIADAS_SOLICITUDES',
  ..., 429)`, reutilizando el mismo errorCode/traducción ES/EN que ya
  usa el throttler HTTP (cero i18n nuevo). `limpiar(idSocket)` se llama
  desde `ChatbotGateway.handleDisconnect` para no dejar crecer el mapa
  sin límite con sockets ya cerrados — mismo patrón que
  `historiales.delete()` en esa misma función.
- Aplicado vía `@UseGuards(ChatbotWsThrottlerGuard, WsJwtGuard,
  LimitePlanGratisGuard)` en `manejarMensaje` (primero, antes de tocar
  JWT/plan — rechazar una ráfaga no debería requerir verificar el token).
- Comentario de `ws-aware-throttler.guard.ts` actualizado — ya no dice
  "no hace falta un throttler consciente de sockets", ahora documenta
  dónde vive el real.
- 5 tests nuevos (`ws-throttler.guard.spec.ts`, con fake timers):
  permite hasta el máximo en la ventana, rechaza el que la excede con el
  errorCode/statusCode correctos, vuelve a permitir tras pasar la
  ventana, cuenta cada socket por separado, y `limpiar()` resetea el
  contador. Suite completa del backend: **150/150 tests pasan**.

**Verificado en Chrome real contra el backend y Groq reales (no
mocks)**: conexión de prueba aparte (socket.io-client cargado desde CDN
en la misma pestaña autenticada, para poder disparar mensajes en
paralelo sin que la UI del widget serialice el envío esperando cada
respuesta) mandó 6 mensajes reales en ráfaga → **5 completaron con
`respuesta-fin` real (5 llamadas reales a Groq) y exactamente el 6to fue
rechazado con `error-chatbot` real, `errorCode: "DEMASIADAS_SOLICITUDES"`,
`statusCode: 429`** — el límite funciona de punta a punta, no solo en
el test unitario con timers falsos.

### 2. QA: test E2E del wizard de reserva pública ✅
No existía ningún framework de E2E en el repo — se eligió **Playwright**
sobre Cypress: soporte nativo de TypeScript sin config aparte (coherente
con el resto del monorepo, todo TS), corre headless de fábrica sin
depender de Electron/una GUI (más liviano en este entorno sandboxed y en
CI), auto-espera en cada acción en vez de reintentos manuales, y su
opción `webServer` admite arrancar VARIOS procesos a la vez — necesario
acá porque el test ejercita frontend Y backend reales al mismo tiempo,
algo que Cypress no orquesta de forma nativa (solo un servidor bajo
prueba).

- `apps/frontend/playwright.config.ts`: `webServer` con dos entradas
  (`npm run dev` del frontend contra `:5173`, `npm run start:dev` del
  backend contra `:3000/health`), `reuseExistingServer: true` — reusa
  los servidores de desarrollo si ya están arriba (como en esta sesión)
  o los levanta desde cero en CI.
- `apps/frontend/e2e/reserva-publica.spec.ts`: el flujo completo del
  wizard de 4 pasos como un visitante SIN sesión, contra el frontend y
  el backend REALES (nunca mocks). El negocio/servicio/disponibilidad
  se crean vía API al vuelo con datos únicos por corrida (timestamp) en
  vez de depender del negocio demo compartido — el test es repetible y
  aislado en cualquier ejecución. Disponibilidad de 00:00 a 23:00 los 7
  días de la semana para no depender de la hora del día en que corre el
  test (`listarHorarios` excluye horarios ya pasados del día actual, ver
  código de `ReservaPublicaService`).
- La verificación final no se queda en la pantalla de "¡Reserva
  confirmada!" — hace un `GET /reservas` real como el admin recién
  registrado y confirma que la reserva del cliente de prueba existe de
  verdad en la base de datos y no quedó cancelada.
- `socket.io-client` ya usado por el chatbot no interfiere: el wizard
  público no lo toca.
- `package.json` del frontend: nuevo script `test:e2e` (`playwright
  test`); `tsconfig.node.json` ampliado para tipar `playwright.config.ts`
  y `e2e/**/*.ts` (antes solo cubría `vite.config.ts`); `.gitignore`
  raíz con las carpetas de artefactos de Playwright
  (`test-results/`, `playwright-report/`, `blob-report/`).

**Corrido de verdad dos veces seguidas contra los servidores de
desarrollo reales de esta sesión (no un entorno de CI simulado)**: las
dos corridas pasaron limpio (`1 passed`, ~9s cada una). Un bug de
locator real (no de la app) se encontró y arregló en el camino: `Tus
datos`/`Confirma tu reserva` aparecen dos veces en el DOM (una en el
indicador de pasos, otra en el `<h2>` del paso activo) — Playwright en
modo estricto lo marca como ambiguo; se resolvió apuntando el locator al
rol `heading` específicamente. **Nota de datos**: cada corrida deja un
negocio/admin/servicio/reserva de prueba reales en la base de datos de
desarrollo (aislados, con sufijo de timestamp) — mismo criterio ya
aplicado toda la sesión de dejar datos de prueba reales sin necesidad de
limpiarlos manualmente, no le pisan nada al negocio demo compartido.

Pendientes menores sin resolver, ninguno bloqueante (heredados de la
tarjeta de responsive, siguen igual): (1) el onboarding del frontend
puede chocar con el límite de 3 servicios del plan gratis si una
plantilla de vertical sugiere más de 3; (2) la mayoría de los mensajes
de validación de los DTOs (fuera de la contraseña) todavía no usan
claves de i18n en el backend; (3) solo Landing/Dashboard/navbar están
traducidos de verdad, el resto (incluidas las 3 pantallas nuevas de esta
tarjeta) sigue en español fijo; (4) el link real del wizard
(`/reservar/:idNegocio`) todavía no está enlazado desde ninguna pantalla
del admin; (5) un cron real de `RECORDATORIO` sigue sin construirse;
(6) la auditoría responsive es por código + verificación de escritorio,
no una captura de pantalla real en 390px (limitación de la herramienta
de automatización del navegador, no del código).

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

```bash
cd apps/frontend
npm install
npm run dev       # http://localhost:5173
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
