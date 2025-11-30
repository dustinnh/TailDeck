# TailDeck

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern web dashboard for managing [Headscale](https://headscale.net/) - the self-hosted implementation of Tailscale's control server.

## Features

- **Device Management**: View, rename, tag, expire, and delete nodes
- **Bulk Operations**: Select multiple machines for batch operations
- **Route Management**: Enable/disable advertised routes
- **DNS Configuration**: Manage nameservers, search domains, and MagicDNS
- **API Keys**: Create and manage Headscale API keys
- **ACL Policies**: Edit access control policies with JSON editor
- **Audit Logging**: Track all changes with comprehensive audit trail
- **Role-Based Access**: OWNER > ADMIN > OPERATOR > AUDITOR > USER hierarchy
- **OIDC Authentication**: Integrate with Authentik, Keycloak, or any OIDC provider

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/taildeck.git
cd taildeck

# Run automated setup
./scripts/setup.sh

# Follow the Authentik configuration instructions
# Then start the development server
npm run dev
```

Open http://localhost:3000 - the first user to sign in becomes OWNER.

## Requirements

- Docker & Docker Compose
- Node.js 18+
- 4GB RAM minimum

## Documentation

- **[SETUP.md](./SETUP.md)** - Complete setup guide with troubleshooting
- **[CLAUDE.md](./CLAUDE.md)** - Developer documentation and architecture

## Architecture

```
TailDeck ──────▶ Headscale (VPN coordination)
    │
    ├──────────▶ PostgreSQL (app data, audit logs)
    │
    └──────────▶ Authentik (OIDC authentication)
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, TanStack Query, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM, Auth.js v5
- **Infrastructure**: PostgreSQL, Headscale, Authentik, Docker

## Development

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
npm install

# Set up database
npm run db:generate
npm run db:push
npm run db:seed

# Start development server
npm run dev
```

### Available Scripts

| Command               | Description                |
| --------------------- | -------------------------- |
| `npm run dev`         | Start development server   |
| `npm run build`       | Build for production       |
| `npm run start`       | Start production server    |
| `npm run lint`        | Run ESLint                 |
| `npm run typecheck`   | Run TypeScript checks      |
| `npm run db:generate` | Generate Prisma client     |
| `npm run db:push`     | Push schema to database    |
| `npm run db:seed`     | Seed roles and permissions |

## Docker

### Development (recommended)

```bash
# Start infrastructure only
docker compose up -d

# Run Next.js locally for hot reload
npm run dev
```

### Production

```bash
# Build and run everything in Docker
docker compose --profile app up -d --build
```

## Role Hierarchy

| Role     | Permissions                              |
| -------- | ---------------------------------------- |
| OWNER    | Full access, manage API keys             |
| ADMIN    | Settings, policies, DNS, user management |
| OPERATOR | Machine management, routes, tags         |
| AUDITOR  | Read-only access to audit logs           |
| USER     | View own devices only                    |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint && npm run typecheck`
5. Submit a pull request

## License

MIT

## Acknowledgments

- [Headscale](https://github.com/juanfont/headscale) - Self-hosted Tailscale control server
- [Authentik](https://goauthentik.io/) - Identity provider
- [shadcn/ui](https://ui.shadcn.com/) - UI components
