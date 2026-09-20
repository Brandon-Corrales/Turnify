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

## Tarea en curso
**Todo el Backend de docs/spec.md (punto 18) está terminado, salvo el
Módulo Chatbot.** No queda ninguna otra tarjeta de Backend pendiente —
Seguridad (categoría completa), Notificaciones (Resend + Meta WhatsApp),
Suscripciones (Stripe Test Mode, verificado solo con mocks por la
restricción geográfica de Stripe en Costa Rica), Reportes, Documentación
Swagger, i18n backend, el guard de límites del plan gratis y este guard
de privilegios por nivel_cliente están todos cerrados y verificados
contra Postgres real.

**Backend: Módulo Chatbot (WebSocket Gateway + integración con LLM)**
queda **en pausa a propósito**, no iniciado: necesita que el equipo
decida primero qué proveedor de LLM usar (Claude, OpenAI, u otro) y
consiga su propia API key — el brief además pide avisarle al equipo para
que se agregue como tarjetas nuevas antes de construirlo, porque no
estaba en el backlog original de Trello. No hay nada más que resolver de
este lado hasta que llegue esa decisión.

Pendientes menores sin resolver, ninguno bloqueante: (1) el onboarding
del frontend puede chocar con el límite de 3 servicios del plan gratis
si una plantilla de vertical sugiere más de 3 (ver nota de Suscripciones
arriba) — trabajo de frontend, no de backend; (2) la mayoría de los
mensajes de validación de los DTOs (fuera de la contraseña) todavía no
usan claves de i18n (ver nota de i18n backend arriba).

**Esta sesión se detiene aquí a propósito** por límite de tokens (se
restablecen a las 20:10) — no es una interrupción a media tarea, todo lo
de arriba está comiteado y verificado. Al retomar: leer este archivo y
`git log --oneline -20`, y decidir con el equipo si se sigue con el
Módulo Chatbot (una vez haya proveedor de LLM + API key) o se salta
directo a las tarjetas de Frontend marcadas "después del Seguimiento
#2" (Landing pública, Dashboard con KPIs, wizard de reserva pública,
Notificaciones/Reportes en pantalla, selector de idioma, responsive,
dark mode, etc. — ver punto 18 de docs/spec.md).

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
