# AI TeleHealth Super App

Production-grade telehealth SaaS — built as a structured learning project across 9 phases.

## Stack
- **Backend:** Node.js, Express, REST microservices, API Gateway
- **DBs:** PostgreSQL (relational), MongoDB (logs / unstructured)
- **Frontend:** React + Vite (doctor + admin web), React Native + Expo (patient mobile)
- **Cloud:** AWS EC2, S3 (files), Vercel (web hosting), Docker (everywhere)
- **Quality:** ESLint, SonarQube, Playwright E2E

## Architecture (one-liner)
Mobile/Web clients → API Gateway → 5 microservices (Auth / User / Appointment / Upload / Notification) → Postgres + Mongo + S3.

See `docs/architecture.md` (Phase 1 deliverable, written next).

## Quickstart (Phase 2)

```powershell
# 1. Clone & enter
git clone <repo-url>
cd telehealth-superapp

# 2. Configure secrets
copy .env.example .env
# Then open .env and fill in real values

# 3. Start local databases
npm run db:up

# 4. Verify
npm run db:psql       # opens psql shell inside Postgres container
npm run db:mongo      # opens mongosh inside Mongo container
```

## Project structure
```
telehealth-superapp/
├── packages/                 # monorepo workspaces
│   ├── shared/               # shared types & utils
│   ├── api-gateway/          # public-facing entry point (port 4000)
│   ├── auth-service/         # JWT + SSO              (port 4001)
│   ├── user-service/         # profiles               (port 4002)
│   ├── appointment-service/  # bookings               (port 4003)
│   ├── upload-service/       # S3 presigned URLs      (port 4004)
│   ├── notification-service/ # email / SMS / push     (port 4005)
│   ├── web-doctor/           # React + Vite, deploys to Vercel
│   ├── web-admin/            # React + Vite, deploys to Vercel
│   └── mobile-patient/       # React Native + Expo + OTA
├── infra/                    # nginx config, deploy scripts
├── tests/e2e/                # Playwright tests
└── docker-compose.yml        # local dev DBs + services
```

## Phases
1. **System Design** — architecture, microservices, data flow ✅
2. **Dev Environment** — Node, Docker, monorepo, local DBs ⬅ *current*
3. Backend microservices
4. Database engineering
5. React web dashboards
6. React Native mobile + OTA
7. Cloud & DevOps (EC2, S3, Vercel)
8. Engineering quality (ESLint, SonarQube, Playwright)
9. Production engineering (logging, monitoring, scaling)

## License
Private learning project. Not for distribution.
