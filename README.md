# TailDeck

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern web dashboard for managing [Headscale](https://headscale.net/) - the self-hosted implementation of Tailscale's control server.

**[Website](https://taildeck.org)** | **[Watch the Demo](https://youtu.be/xDxq1LksAJc)**

---

## TL;DR - Quick Install

```bash
git clone https://github.com/yourusername/taildeck.git
cd taildeck
./scripts/setup.sh    # Interactive setup wizard
npm run dev           # Start development server
```

The setup script handles everything: Docker services, environment config, Authentik OIDC, Headscale API keys, and database setup. Open http://localhost:3000 after setup - the first user to sign in becomes OWNER.

**[Full Installation Walkthrough](./INSTALL_WALKTHROUGH.md)** | **[Detailed Setup Guide](./SETUP.md)**

---

## Features

### Core Management

- **Device Management**: View, rename, tag, expire, and delete nodes
- **Bulk Operations**: Select multiple machines for batch operations
- **Route Management**: Enable/disable advertised routes and exit nodes
- **DNS Configuration**: Manage nameservers, search domains, and MagicDNS
- **API Keys**: Create and manage Headscale API keys with expiration
- **ACL Policies**: Edit access control policies with JSON editor

### Observability

- **Network Topology**: Interactive visualization of your mesh network
- **Server Logs**: Real-time Headscale container log viewer with filtering
- **NetFlow Collection**: Network flow data from Tailscale nodes (via GoFlow2)
- **Health Dashboard**: Real-time service health monitoring
- **Audit Logging**: Track all changes with comprehensive audit trail

### Security & Access

- **Role-Based Access**: OWNER > ADMIN > OPERATOR > AUDITOR > USER hierarchy
- **OIDC Authentication**: Integrate with Authentik, Keycloak, or any OIDC provider
- **Security Warnings**: Pre-flight checks for misconfigurations
- **Setup Wizard**: Web-based configuration with health diagnostics

---

## Requirements

| Requirement    | Minimum | Recommended |
| -------------- | ------- | ----------- |
| Docker         | 20.10+  | Latest      |
| Docker Compose | 2.0+    | Latest      |
| Node.js        | 18.0+   | 20.x LTS    |
| RAM            | 4GB     | 8GB         |
| Disk           | 10GB    | 20GB        |

---

## Scripts

TailDeck includes helper scripts for common operations:

| Script                       | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| `./scripts/setup.sh`         | Interactive setup wizard with pre-flight checks |
| `./scripts/setup.sh --quick` | Quick mode with development defaults            |
| `./scripts/cleanup.sh`       | Reset to fresh install (removes all data)       |

### Setup Script Options

```bash
./scripts/setup.sh [options]

Options:
  --quick, -q       Quick mode with defaults (development)
  --skip-authentik  Skip automatic Authentik OIDC configuration
  --skip-docker     Skip Docker service management
  --help, -h        Show help message
```

### What the Setup Script Does

The setup script automates the entire first-time configuration:

1. **Pre-flight Checks**: Verifies Docker, Node.js, and port availability
2. **Environment Configuration**:
   - Creates `.env.local` from template
   - Generates secure `AUTH_SECRET` (32-byte random)
   - Generates `AUTHENTIK_BOOTSTRAP_TOKEN` for API automation
3. **Dependency Installation**: Runs `npm install`
4. **Headscale Configuration**: Generates `headscale/config.yaml` from template
5. **Docker Services**: Starts PostgreSQL, Redis, Authentik, Headscale, and GoFlow2
6. **Headscale API Key**: Auto-generates API key and updates `.env.local`
7. **Database Setup**: Runs Prisma migrations and seeds roles/permissions
8. **Authentik OIDC Setup** (automatic):
   - Creates OAuth2 provider with correct redirect URIs
   - Creates TailDeck application linked to provider
   - Creates RBAC groups (Admins, Operators, Auditors, Users)
   - Updates `AUTH_AUTHENTIK_SECRET` in `.env.local`

After setup completes, just run `npm run dev` and sign in - the first user becomes OWNER.

---

## Documentation

| Document                                               | Description                                  |
| ------------------------------------------------------ | -------------------------------------------- |
| **[INSTALL_WALKTHROUGH.md](./INSTALL_WALKTHROUGH.md)** | Step-by-step installation guide              |
| **[SETUP.md](./SETUP.md)**                             | Detailed configuration reference             |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)**               | Developer documentation and architecture     |
| **[docs/NETFLOW_SETUP.md](./docs/NETFLOW_SETUP.md)**   | NetFlow collection setup for Tailscale nodes |

---

## Architecture

```
                          ┌─────────────────────────────────────┐
                          │           TailDeck                  │
                          │  ┌───────────┐  ┌────────────────┐  │
   Browser ──────────────▶│  │  Next.js  │  │  Setup Wizard  │  │
                          │  │  Frontend │  │  (Web UI)      │  │
                          │  └─────┬─────┘  └────────────────┘  │
                          │        │                            │
                          │  ┌─────▼─────────────────────────┐  │
                          │  │    Next.js API Routes         │  │
                          │  │    (BFF - Backend for Frontend)│  │
                          │  └───┬─────────┬─────────┬───────┘  │
                          └─────│─────────│─────────│───────────┘
                                │         │         │
              ┌─────────────────▼─┐ ┌─────▼─────┐ ┌─▼─────────────┐
              │    Headscale      │ │ PostgreSQL│ │   Authentik   │
              │  (VPN Control)    │ │ (App Data)│ │   (OIDC)      │
              └───────────────────┘ └───────────┘ └───────────────┘
```

### Key Design Decisions

- **BFF Pattern**: Browser never directly contacts Headscale - all API calls proxied through secure backend
- **JWT Sessions**: Reduced database load compared to database sessions
- **Optimistic Updates**: TanStack Query with automatic rollback on errors
- **Server-Only Secrets**: Headscale API keys and sensitive config never exposed to client

---

## Tech Stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| Frontend       | Next.js 14, React 18, TanStack Query, Tailwind CSS |
| UI Components  | shadcn/ui, Lucide Icons                            |
| Backend        | Next.js API Routes, Prisma ORM                     |
| Authentication | Auth.js v5 with Authentik OIDC                     |
| Database       | PostgreSQL                                         |
| Infrastructure | Docker, Headscale, Authentik, Redis, GoFlow2       |

---

## Development

### Quick Start (Development)

```bash
# Install dependencies
npm install

# Start infrastructure only (recommended for development)
docker compose up -d

# Set up database
npm run db:generate && npm run db:push && npm run db:seed

# Start dev server with hot reload
npm run dev
```

### Available Commands

| Command               | Description                |
| --------------------- | -------------------------- |
| `npm run dev`         | Start development server   |
| `npm run build`       | Build for production       |
| `npm run start`       | Start production server    |
| `npm run lint`        | Run ESLint                 |
| `npm run lint:fix`    | Auto-fix ESLint issues     |
| `npm run typecheck`   | Run TypeScript checks      |
| `npm run db:generate` | Generate Prisma client     |
| `npm run db:push`     | Push schema to database    |
| `npm run db:migrate`  | Create database migrations |
| `npm run db:seed`     | Seed roles and permissions |

---

## Production Deployment

### Option A: Full Docker Stack

```bash
# Build and run everything in Docker
docker compose --profile app up -d --build
```

### Option B: Separate App Server

```bash
# On infrastructure server
docker compose up -d

# On app server
npm ci
npm run build
npm start
```

### Reverse Proxy (Caddy)

If using Caddy for TLS termination:

```caddyfile
taildeck.yourdomain.com {
    reverse_proxy localhost:3000
}

auth.yourdomain.com {
    reverse_proxy localhost:9000
}

headscale.yourdomain.com {
    reverse_proxy localhost:8080
}
```

**Important**: Update `.env.local` with external URLs:

- `AUTH_URL` - Your TailDeck URL (e.g., `https://taildeck.yourdomain.com`)
- `AUTH_AUTHENTIK_ISSUER` - Your Authentik URL (e.g., `https://auth.yourdomain.com/application/o/taildeck/`)

See **[SETUP.md](./SETUP.md)** for production environment variables and TLS configuration.

---

## Role Hierarchy

| Role     | Permissions                                      |
| -------- | ------------------------------------------------ |
| OWNER    | Full access, API key management, system settings |
| ADMIN    | Settings, policies, DNS, user management         |
| OPERATOR | Machine management, routes, tags                 |
| AUDITOR  | Read-only access to audit logs                   |
| USER     | View own devices only (user portal)              |

---

## Web Setup Wizard

After initial deployment, access the setup wizard at `/setup` to:

1. **Verify Services**: Check Database, Headscale, and OIDC connectivity
2. **Configure Domain**: Set public URLs and domain settings
3. **Enable MagicDNS**: Configure DNS settings with sensible defaults
4. **Security Review**: Address any security warnings before going live
5. **Complete Setup**: Mark installation as complete

The wizard includes real-time health diagnostics and security warnings for common misconfigurations.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run checks: `npm run lint && npm run typecheck`
5. Commit with descriptive message
6. Submit a pull request

---

## License

MIT

---

## Acknowledgments

- [Headscale](https://github.com/juanfont/headscale) - Self-hosted Tailscale control server
- [Authentik](https://goauthentik.io/) - Identity provider
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [TanStack Query](https://tanstack.com/query) - Data fetching
