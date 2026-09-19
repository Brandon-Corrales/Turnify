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
| WhatsApp | Twilio Sandbox |
| Pagos | Stripe (Test Mode) |
| Internacionalización | react-i18next (frontend) · nestjs-i18n (backend) — ES / EN |
| CI/CD | GitHub Actions |
| Hosting | Vercel (frontend) · Render/Railway (backend) |

## Estructura del repositorio
```
turnify/
├── apps/
│   ├── frontend/
│   └── backend/
├── packages/
│   └── shared-types/
├── .github/workflows/ci.yml
├── docker-compose.yml
└── .env.example
```

## Puesta en marcha local
```bash
# Desde la raíz del monorepo
npm install
cp .env.example .env      # un solo .env compartido por docker-compose, TypeORM y NestJS
docker compose up -d      # Postgres local

# Backend
npm run backend:migrate --workspace=apps/backend   # o: cd apps/backend && npm run migration:run
npm run backend:seed --workspace=apps/backend       # datos demo (negocio, admin, servicios, clientes)
npm run backend:dev                                 # http://localhost:3000 (Swagger en /docs)

# Frontend
cd apps/frontend
npm install
npm run dev
```

## Licencia
Proyecto académico — UNA Costa Rica, 2026.