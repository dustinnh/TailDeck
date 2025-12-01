# Contributing to TailDeck

Developer documentation for contributing to TailDeck.

## Project Overview

TailDeck is a Headscale admin dashboard built with Next.js 14, using a Backend-for-Frontend (BFF) pattern. The browser never directly contacts Headscale—all sensitive operations are proxied through the secure backend which holds the Headscale API key server-side.

## Current Status

- OIDC Login → TailDeck → Headscale API → Display Nodes
- Setup wizard with health diagnostics and security warnings
- Flow log explorer with Loki integration
- Full CRUD operations for machines, routes, DNS, policies

## Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix ESLint issues
npm run typecheck    # Run TypeScript type check
npm run format       # Format with Prettier

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create migrations
npm run db:seed      # Seed initial data

# Docker environment
docker compose up -d              # Start all services
docker compose logs -f authentik  # View Authentik logs
docker compose logs -f headscale  # View Headscale logs

# Setup & Maintenance Scripts
./scripts/setup.sh    # Interactive setup wizard
./scripts/cleanup.sh  # Reset to fresh install state
```

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (dashboard)/          # Protected routes with header
│   │   ├── machines/         # Machine management
│   │   ├── routes/           # Route & exit node management
│   │   ├── dns/              # DNS & MagicDNS config
│   │   ├── policies/         # ACL policy editor
│   │   ├── flow-logs/        # Flow log explorer
│   │   ├── audit/            # Audit log viewer
│   │   ├── setup/            # Setup wizard (web UI)
│   │   │   ├── page.tsx
│   │   │   ├── setup-wizard-client.tsx
│   │   │   ├── components/   # Step indicator, health cards
│   │   │   └── steps/        # Welcome, Domain, DNS, Security, Completion
│   │   └── layout.tsx        # Auth-protected layout
│   ├── api/
│   │   ├── auth/             # Auth.js route handlers
│   │   ├── headscale/        # Headscale proxy routes
│   │   ├── setup/            # Setup status & diagnostics API
│   │   ├── flowlogs/         # Flow log query API
│   │   └── audit/            # Audit log API
│   ├── layout.tsx            # Root layout with providers
│   └── page.tsx              # Landing page
├── components/
│   ├── layout/               # Header, Providers
│   ├── setup/                # SetupPrompt for dashboard
│   └── ui/                   # ShadCN components
├── lib/
│   ├── auth.ts               # Auth.js configuration
│   ├── auth.config.ts        # Edge-compatible auth config
│   ├── db.ts                 # Prisma client singleton
│   ├── env.ts                # Zod environment validation
│   ├── logger.ts             # Pino logger with secret redaction
│   ├── api/
│   │   ├── hooks/            # TanStack Query hooks
│   │   │   ├── use-setup.ts  # Setup wizard hooks
│   │   │   └── ...           # Other API hooks
│   │   └── query-keys.ts     # Query key constants
│   └── utils.ts              # ShadCN utilities
├── server/
│   ├── headscale/            # SERVER-ONLY Headscale client
│   │   ├── client.ts         # API client with validation
│   │   ├── schemas.ts        # Zod response schemas
│   │   └── types.ts          # TypeScript interfaces
│   ├── authentik/            # SERVER-ONLY Authentik client
│   │   ├── client.ts         # API client for auto-config
│   │   ├── schemas.ts        # Zod schemas
│   │   └── types.ts          # TypeScript interfaces
│   ├── services/
│   │   ├── setup.ts          # Setup completion state
│   │   └── diagnostics.ts    # Health check services
│   └── flowlogs/             # Flow log provider abstraction
└── types/
    └── next-auth.d.ts        # Auth.js type augmentation

scripts/
├── setup.sh                  # Interactive CLI setup wizard
├── cleanup.sh                # Reset to fresh install
├── setup-authentik.ts        # Authentik auto-configuration
└── lib/                      # Bash script libraries
    ├── colors.sh             # Terminal colors
    ├── prompts.sh            # User prompts
    ├── validation.sh         # Pre-flight checks
    ├── docker.sh             # Docker helpers
    ├── headscale.sh          # Headscale config generation
    └── authentik.sh          # Authentik API helpers

headscale/
└── config.yaml.template      # Headscale config template
```

## Security Guidelines

- **Server-only code**: Files in `src/server/` must NEVER be imported by client components
- **Environment validation**: All env vars validated with Zod at startup (`src/lib/env.ts`)
- **Secret redaction**: Pino logger automatically redacts secrets (`src/lib/logger.ts`)
- **Security headers**: CSP, X-Frame-Options, etc. configured in `next.config.mjs`
- **BFF pattern**: Headscale API key never exposed to browser
- **Setup wizard**: Validates security configuration before completion

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Auth**: Auth.js v5 with Authentik OIDC
- **Database**: PostgreSQL with Prisma ORM
- **Data Fetching**: TanStack Query with optimistic updates
- **UI**: Tailwind CSS + ShadCN components
- **Visualization**: React Flow (network topology), dnd-kit (ACL builder)
- **Reverse Proxy**: Caddy
- **Deployment**: Docker Compose or Kubernetes

## Architecture

```
Browser → TailDeck Frontend → TailDeck Backend → Headscale API
                                    ↓
                              PostgreSQL
                                    ↓
                            Loki (optional flow logs)
```

### Key Architectural Decisions

- **JWT sessions** over database sessions for reduced load
- **Optimistic updates** in TanStack Query with automatic invalidation on errors
- **ACL builder dual-mode**: Visual UI format converts to Headscale's HuJSON on save
- **API key encryption**: XChaCha20-Poly1305 (sodium-plus) with prepended nonce
- **Pluggable flow log providers**: Abstract interface supports Loki, Elasticsearch, or custom backends
- **Setup wizard**: Both CLI (`setup.sh`) and web-based (`/setup`) options

## RBAC Roles

Roles are enforced at the API layer (UI hides controls for UX only):

| Role     | Capabilities                                                |
| -------- | ----------------------------------------------------------- |
| OWNER    | Full access including role management, setup wizard         |
| ADMIN    | Manage configuration, users, ACLs, DNS                      |
| OPERATOR | Manage machines, routes, exit nodes; cannot change ACLs/DNS |
| AUDITOR  | Read-only access including audit log                        |
| USER     | User portal only - manage own devices                       |

## Headscale API Integration

- REST API at `/api/v1` with Bearer token auth
- Metrics at `/metrics` on port 9090 (Prometheus format)
- Generate TypeScript types from OpenAPI spec:
  ```bash
  npx openapi-typescript https://headscale.example.com/swagger/v1/openapiv2.json -o ./src/api/types.ts
  ```

## Database Schema

Key models in Prisma schema:

- `User`, `Role`, `Permission`, `UserRole`, `RolePermission` - RBAC system
- `SystemSettings` - Setup completion state, dismissed warnings, health cache
- `HeadscaleInstance` - Multi-instance ready (enforced to one in OSS v1)
- `AuditLog` - Records all mutating actions with before/after state
- `ACLTemplate` - Built-in and custom ACL templates
- `FlowLogBackend` - Configurable flow log integrations

## Environment Variables

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_AUTHENTIK_ID`, `AUTH_AUTHENTIK_SECRET`, `AUTH_AUTHENTIK_ISSUER` - OIDC config
- `AUTH_SECRET`, `AUTH_URL` - Auth.js config
- `HEADSCALE_URL`, `HEADSCALE_API_KEY` - Headscale connection

Optional:

- `HEADSCALE_METRICS_URL` - Metrics endpoint
- `LOKI_URL`, `LOKI_TENANT_ID`, `LOKI_USERNAME`, `LOKI_PASSWORD` - Flow log integration
- `AUTHENTIK_URL`, `AUTHENTIK_BOOTSTRAP_TOKEN` - Authentik auto-configuration
- `LOG_LEVEL` - Logging verbosity (default: info)

## Setup System

### CLI Setup (`./scripts/setup.sh`)

- Pre-flight checks (Docker, Node.js, ports)
- Interactive configuration prompts
- Generates `.env.local` and `headscale/config.yaml`
- Starts Docker services
- Creates Headscale API key
- Sets up database

### Web Setup Wizard (`/setup`)

- 5-step wizard: Welcome → Domain → DNS → Security → Complete
- Real-time health diagnostics
- Security warning system (critical/warning/info)
- Dismissible vs blocking warnings
- Stored in `SystemSettings` table

### Diagnostics Service (`src/server/services/diagnostics.ts`)

- Database health check
- Headscale API connectivity
- OIDC provider validation
- Security configuration audit

## Code Quality Requirements

- All inputs validated with Zod schemas
- Rate limiting on all endpoints (stricter 5 req/15min on auth)
- API keys encrypted at rest
- Audit logging for all mutations
- Security headers via Caddy or middleware
- Pino logger with automatic secret redaction
- Setup wizard validates HTTPS, strong secrets, OIDC config

## Navigation Structure

**Admin Views**: Dashboard, Machines, Routes & Exit Nodes, Access Policies (ACLs), DNS & MagicDNS, Health & Observability, Flow Logs, Audit Log, Settings, Setup (OWNER only)

**User Portal**: My Devices, Get Started, Activity

## Pull Request Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run checks: `npm run lint && npm run typecheck`
5. Commit with descriptive message
6. Submit a pull request

## Testing Locally

```bash
# Fresh install test
./scripts/cleanup.sh
./scripts/setup.sh
npm run dev
```
