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
| Hosting | Vercel (frontend) · Render/Railway (backend) |

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

### Respaldo opcional: Postgres local aislado
Solo para pruebas destructivas que no deben afectar la base de datos compartida de Supabase.
```bash
npm run db:up      # levanta Postgres local vía docker-compose
npm run db:down    # lo detiene
```

## Licencia
Proyecto académico — UNA Costa Rica, 2026.