# Turnify

Plataforma de reservas y turnos con notificaciones automatizadas para negocios de servicios (clínicas, barberías, consultorios, academias, PYMES).

Proyecto final — **EIF409 Aplicaciones Informáticas Globales**, Universidad Nacional de Costa Rica, Sede Regional Chorotega, Campus Nicoya.
Docente: Ing. Francisco Javier Coulon Ollivier.

## Equipo — Grupo #4
- Brandon Núñez Corrales
- José Andrés Picado Zamora
- Dixon Gaitán Martínez
- Brenda Espinoza Matarrita

## Stack
| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite + TailwindCSS + FullCalendar.js |
| Backend | NestJS + TypeScript + TypeORM + PostgreSQL |
| Base de datos | PostgreSQL (Supabase) |
| Correo | Resend |
| WhatsApp | Meta WhatsApp Cloud API |
| Pagos | Stripe (Test Mode) |
| Chatbot / LLM | Groq |
| Internacionalización | react-i18next (frontend) · nestjs-i18n (backend) — ES / EN |
| CI/CD | GitHub Actions |
| Hosting | Render (frontend como sitio estático · backend como servicio web) |

## Estructura del repositorio
```
turnify/
├── apps/
│   ├── frontend/
│   └── backend/
├── .github/workflows/ci.yml
├── docker-compose.yml
└── .env.example
```

## Puesta en marcha local
El equipo **no** trabaja contra una base de datos Postgres local: todos se conectan a la
misma base de datos real en Supabase, usando el mismo `.env`. Ese `.env` se comparte
directo entre el equipo (no se genera a partir de `.env.example`) — pídelo a algún
miembro del equipo y colócalo en la raíz del monorepo.

`docker-compose.yml` levanta un Postgres local, pero es solo un respaldo opcional para
pruebas destructivas que no deben tocar la base de datos compartida (por ejemplo,
probar migraciones riesgosas). No es parte del flujo normal de arranque.

```bash
# Desde la raíz del monorepo
npm install
# coloca el .env compartido por el equipo en la raíz (no se genera desde .env.example)

# Backend
npm run backend:migrate   # o: cd apps/backend && npm run migration:run
npm run backend:seed      # datos demo (negocio, admin, servicios, clientes)
npm run backend:dev       # http://localhost:3000 (Swagger en /docs)

# Frontend (en otra terminal, desde la raíz)
npm run frontend:dev
```

## Ambientes
| Variable | Desarrollo | Pruebas (integración/E2E) | Producción |
|---|---|---|---|
| `NODE_ENV` | `development` | `test` (lo fijan los scripts) | `production` |
| Base de datos | `DATABASE_URL` del `.env` compartido (hoy, Supabase) o `DB_*` locales | `TEST_DATABASE_URL`, solo local (ver [Pruebas](#pruebas)) | `DATABASE_URL` en el entorno del servidor |
| `DB_SSL_CA` / `DB_SSL_CA_PATH` | No | No | Recomendado (ver abajo) |
| `MIGRATIONS_RUN_ON_START` | `false` | No aplica (los scripts migran) | `false` (migraciones a mano) |
| i18n con recarga de archivos (`watch`) | Sí | No | No |
| Proveedores (Resend, WhatsApp, Stripe, Groq) | Claves de prueba del `.env` | Vacías: no se llama a ninguno | Claves del entorno del servidor |

Cómo se separan: cada ambiente define sus propias variables (el `.env` local para
desarrollo, las variables del proceso para pruebas y el panel del hosting para
producción). Hoy **desarrollo y producción comparten la misma base de Supabase**: no
hay una base separada para desarrollo. Por eso, al arrancar con
`NODE_ENV=development` y una base remota, el backend deja esta advertencia en el log;
también avisa si `NODE_ENV=production` apunta a una base local. La advertencia no
bloquea el arranque ni muestra el host ni la cadena de conexión.

### Migraciones en producción
Las migraciones **no** se aplican solas al arrancar. Procedimiento manual:
1. Respaldar la base (ver "Respaldos" abajo).
2. Ver qué falta aplicar, desde una máquina con el `DATABASE_URL` de producción en el
   entorno: `npm run migration:show --workspace=apps/backend` (`[X]` aplicada, `[ ]`
   pendiente).
3. Aplicar: `npm run backend:migrate` (una transacción por migración; si una falla,
   se detiene ahí).
4. Repetir el paso 2 y comprobar que todas quedaron en `[X]`.
5. Para deshacer la última: `npm run migration:revert --workspace=apps/backend`.

Modo opcional: con `MIGRATIONS_RUN_ON_START=true`, el backend aplica las pendientes al
arrancar, antes de aceptar solicitudes (usa las migraciones compiladas en
`dist/database/migrations`). Está desactivado por defecto; si una migración falla, el
backend no arranca.

### Respaldos
El repositorio no define una estrategia de respaldos. Para documentarla hace falta
revisar en el panel de Supabase: qué respaldos automáticos incluye el plan actual y con
qué frecuencia y retención, si está disponible la recuperación a un punto en el tiempo
(PITR) y cómo se restaura un respaldo. Mientras tanto, antes de cada migración en
producción se recomienda un respaldo manual (por ejemplo, con `pg_dump`).

### Conexión segura a la base de datos (SSL)
Por defecto, con `DATABASE_URL` la conexión va cifrada pero **no valida el
certificado** del servidor (`rejectUnauthorized: false`), como siempre lo ha hecho.
Para validarlo (CA y nombre del host, equivalente a `sslmode=verify-full`, lo que
recomienda [Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement)):
1. Descargar la CA del proyecto en el panel de Supabase: **Database Settings → SSL
   Configuration**.
2. Definir **una** de estas variables en el entorno del backend:
   - `DB_SSL_CA`: el contenido PEM (en una sola línea, con `\n` entre líneas).
   - `DB_SSL_CA_PATH`: la ruta a ese archivo `.crt`.
3. Reiniciar el backend. Si el certificado no corresponde, el backend no conecta
   (falla al arrancar, no a medio uso).

La app y el CLI de migraciones usan la misma configuración
(`apps/backend/src/database/opciones-conexion.ts`). Si la CA no está definida, nada
cambia.

## Pruebas
| Comando (desde la raíz) | Qué corre | Base de datos |
|---|---|---|
| `npm test --workspace=apps/backend` / `--workspace=apps/frontend` | Unitarias (Vitest) | Ninguna |
| `npm run test:integration` | Integración del backend (`*.integration.spec.ts`, app completa + supertest) | Postgres local de pruebas |
| `npm run test:e2e` | E2E de Playwright (frontend + backend reales) | Postgres local de pruebas |

Las pruebas de integración y el E2E **escriben datos reales**, así que nunca corren
contra Supabase (es la base de producción). Usan un Postgres aparte, local y
desechable (servicio `postgres-test` de `docker-compose.yml`, puerto 5433, datos en
memoria):

```bash
npm run db:test:up        # levanta el Postgres de pruebas
# en el .env (o en el shell): ver .env.example
TEST_DATABASE_URL=postgresql://turnify_test:turnify_test@localhost:5433/turnify_test
npm run test:integration  # aplica las migraciones y corre las 6 suites
npm run test:e2e          # aplica las migraciones y corre Playwright
npm run db:test:down      # borra el contenedor y sus datos
```

Protecciones:
- Ambas se **niegan a correr** si falta `TEST_DATABASE_URL` o si su host no es local
  (`localhost`, `127.0.0.1` o `::1`), con un mensaje que explica qué hacer.
- La app bajo prueba usa esa base aunque el `.env` tenga el `DATABASE_URL` de Supabase,
  y las claves de Resend, WhatsApp, Stripe y Groq quedan vacías: no se llama a ningún
  proveedor externo.
- El E2E levanta sus propios servidores (backend en el 3100, frontend en el 5174) y no
  reutiliza los de desarrollo.
- La primera vez hay que instalar el navegador de Playwright: `npx playwright install chromium`.

### Webhook de Resend (rebotes y entregas)
El backend expone `POST /webhooks/resend`, que actualiza el historial de
Notificaciones con los eventos de Resend (entregado, demorado, rebotado, marcado
como spam, fallido). Necesita `RESEND_WEBHOOK_SECRET` en el `.env`; sin ella
responde 503 y no procesa nada.

Registro (una vez, **después del deploy**, porque Resend solo llama a una URL
HTTPS pública):
1. En el dashboard de Resend: **Webhooks → Add Webhook**.
2. URL: `https://<dominio-del-backend>/webhooks/resend`.
3. Eventos: `email.delivered`, `email.delivery_delayed`, `email.bounced`,
   `email.complained` y `email.failed`.
4. Copiar el *signing secret* (`whsec_…`) a `RESEND_WEBHOOK_SECRET` en el entorno
   del servidor (nunca en el repo) y reiniciar el backend.
5. Mandar un correo de prueba y revisar en Resend que el evento quedó con
   respuesta 200.

En local, Resend no puede llamar a `localhost`: hace falta un túnel (ngrok) o el
comando `webhooks listen` de la CLI de Resend. Docs:
https://resend.com/docs/webhooks/create-webhook y
https://resend.com/docs/webhooks/verify-webhooks-requests.

### Respaldo opcional: Postgres local aislado
Solo para pruebas destructivas que no deben afectar la base de datos compartida de Supabase.
```bash
npm run db:up      # levanta Postgres local vía docker-compose
npm run db:down    # lo detiene
```

## Licencia
Proyecto académico — UNA Costa Rica, 2026.