# TailDeck Setup Guide

Complete reference guide for configuring TailDeck in development and production environments.

> **Quick Start?** See the [Installation Walkthrough](./INSTALL_WALKTHROUGH.md) for a step-by-step guide.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Setup Scripts](#setup-scripts)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Authentik Configuration](#authentik-configuration)
- [Environment Variables](#environment-variables)
- [Web Setup Wizard](#web-setup-wizard)
- [Flow Logs Configuration](#flow-logs-configuration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

For the fastest setup experience:

```bash
# Clone the repository
git clone https://github.com/dustinnh/taildeck.git
cd taildeck

# Run the interactive setup script
./scripts/setup.sh

# Start the development server
npm run dev
```

Open http://localhost:3000 and complete the web setup wizard.

---

## Prerequisites

### Required Software

| Software       | Minimum Version | Check Command            |
| -------------- | --------------- | ------------------------ |
| Docker         | 20.10+          | `docker --version`       |
| Docker Compose | 2.0+            | `docker compose version` |
| Node.js        | 18.0+           | `node --version`         |
| npm            | 9.0+            | `npm --version`          |

### System Requirements

- **RAM**: 4GB minimum (8GB recommended)
- **Disk**: 10GB free space
- **Ports**: 3000, 5432, 8080, 9000 available

---

## Setup Scripts

TailDeck includes helper scripts to simplify setup and maintenance:

### `./scripts/setup.sh`

Interactive setup wizard that automates the entire first-time configuration:

1. **Pre-flight checks**: Verifies Docker, Node.js, and port availability
2. **Environment configuration**:
   - Creates `.env.local` from template
   - Generates secure `AUTH_SECRET` (32-byte random)
   - Generates `AUTHENTIK_BOOTSTRAP_TOKEN` for API automation
3. **Dependency installation**: Runs `npm install`
4. **Headscale configuration**: Generates `headscale/config.yaml` from template
5. **Docker services**: Starts all infrastructure (PostgreSQL, Authentik, Headscale, GoFlow2)
6. **Headscale API key**: Auto-generates key and updates `.env.local`
7. **Database setup**: Runs Prisma migrations and seeds roles/permissions
8. **Authentik OIDC setup** (automatic via bootstrap token):
   - Creates OAuth2 provider with correct redirect URIs and scopes
   - Creates TailDeck application linked to the provider
   - Creates RBAC groups (Admins, Operators, Auditors, Users)
   - Updates `AUTH_AUTHENTIK_SECRET` in `.env.local`

**Options:**

```bash
./scripts/setup.sh [options]

  --quick, -q       Quick mode with development defaults (non-interactive)
  --skip-authentik  Skip automatic Authentik configuration (manual setup)
  --skip-docker     Skip Docker service management
  --help, -h        Show help message
```

### `./scripts/cleanup.sh`

Reset script that removes:

- All Docker containers
- All Docker volumes (database data)
- `.env` and `.env.local` files
- `.next` build directory
- `headscale/config.yaml`

Use this to start fresh or test the setup process.

### Script Library (`scripts/lib/`)

Modular bash libraries used by the setup scripts:

| Library         | Purpose                              |
| --------------- | ------------------------------------ |
| `colors.sh`     | Terminal color output                |
| `prompts.sh`    | Interactive user prompts             |
| `validation.sh` | Pre-flight checks and validation     |
| `docker.sh`     | Docker container management          |
| `headscale.sh`  | Headscale configuration and API keys |
| `authentik.sh`  | Authentik API automation             |

---

## Development Setup

### Manual Setup (Step by Step)

#### Step 1: Clone and Install

```bash
git clone https://github.com/dustinnh/taildeck.git
cd taildeck
npm install
```

#### Step 2: Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env.local

# Generate a secure AUTH_SECRET
openssl rand -base64 32
# Paste the output as AUTH_SECRET in .env.local
```

#### Step 3: Start Infrastructure

```bash
# Start PostgreSQL, Authentik, and Headscale
docker compose up -d

# Wait for services to be healthy
docker compose ps
```

#### Step 4: Generate Headscale API Key

```bash
docker exec headscale headscale apikeys create --expiration 365d
# Copy output to HEADSCALE_API_KEY in .env.local
```

#### Step 5: Configure Authentik

See [Authentik Configuration](#authentik-configuration) below.

#### Step 6: Set Up Database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

#### Step 7: Start Development Server

```bash
npm run dev
```

---

## Production Setup

### Option A: Full Docker Stack

```bash
# Build and start all services including TailDeck
docker compose --profile app up -d --build

# Run database migrations
docker exec taildeck-app npx prisma db push
docker exec taildeck-app npx prisma db seed
```

### Option B: External App Server

```bash
# On infrastructure server
docker compose up -d

# On app server
npm ci
npm run build
npm start
```

### Production Environment Variables

Required for production:

```env
# Strong random secret (32+ characters)
AUTH_SECRET="<generate with: openssl rand -base64 32>"

# Production URLs (must use HTTPS)
AUTH_URL="https://taildeck.yourdomain.com"
AUTH_AUTHENTIK_ISSUER="https://auth.yourdomain.com/application/o/taildeck/"

# Headscale URL
HEADSCALE_URL="https://headscale.yourdomain.com"
```

### TLS/HTTPS Configuration

For production, place a reverse proxy (Caddy, nginx, Traefik) in front of TailDeck:

```
Client → Reverse Proxy (TLS) → TailDeck (HTTP internal)
```

### Caddy Reverse Proxy

Example Caddyfile for production:

```caddyfile
# TailDeck Dashboard
taildeck.yourdomain.com {
    reverse_proxy localhost:3000
}

# Authentik (OIDC Provider)
auth.yourdomain.com {
    reverse_proxy localhost:9000
}

# Headscale (VPN Control Server)
headscale.yourdomain.com {
    reverse_proxy localhost:8080
}
```

**Important URL Configuration**:

The following environment variables must be set to **externally accessible URLs** (what users see in their browser):

| Variable                | Description           | Example                                               |
| ----------------------- | --------------------- | ----------------------------------------------------- |
| `AUTH_URL`              | TailDeck's public URL | `https://taildeck.yourdomain.com`                     |
| `AUTH_AUTHENTIK_ISSUER` | Authentik OIDC issuer | `https://auth.yourdomain.com/application/o/taildeck/` |

These are **browser redirect URLs**, so they must be reachable from the user's machine, not just from Docker containers.

---

## Authentik Configuration

### Automatic Setup (Recommended)

When you run `./scripts/setup.sh`, Authentik is configured automatically using the **bootstrap token** mechanism:

1. The setup script generates a random `AUTHENTIK_BOOTSTRAP_TOKEN` in `.env.local`
2. This token is passed to Authentik via `docker-compose.yml` environment variable
3. Authentik accepts API requests authenticated with this token
4. The setup script calls `scripts/setup-authentik.ts` which:
   - Creates the OAuth2 provider with correct settings
   - Creates the TailDeck application
   - Creates RBAC groups for role mapping
   - Saves the generated client secret to `.env.local`

**No manual Authentik configuration is needed** when using the setup script.

### Manual Setup (Alternative)

If you used `--skip-authentik` or need to configure manually:

#### 1. Initial Setup

1. Open http://localhost:9000/if/flow/initial-setup/
2. Create your admin account
3. Complete the setup wizard

#### 2. Create OAuth2 Provider

1. Go to **Admin Interface**: http://localhost:9000/admin/
2. Navigate to **Applications** → **Providers**
3. Click **Create** → **OAuth2/OpenID Provider**
4. Configure:

| Field              | Value                                               |
| ------------------ | --------------------------------------------------- |
| Name               | `TailDeck OAuth2`                                   |
| Authorization flow | `default-provider-authorization-implicit-consent`   |
| Client type        | `Confidential`                                      |
| Client ID          | `taildeck`                                          |
| Client Secret      | (click regenerate and copy)                         |
| Redirect URIs      | `http://localhost:3000/api/auth/callback/authentik` |
| Signing Key        | `authentik Self-signed Certificate`                 |

5. Under **Advanced protocol settings**:
   - Scopes: `openid`, `profile`, `email`
6. Click **Create**

#### 3. Create Application

1. Navigate to **Applications** → **Applications**
2. Click **Create**
3. Configure:

| Field    | Value             |
| -------- | ----------------- |
| Name     | `TailDeck`        |
| Slug     | `taildeck`        |
| Provider | `TailDeck OAuth2` |

4. Click **Create**

#### 4. Update Environment

```env
AUTH_AUTHENTIK_SECRET="<paste the client secret>"
```

#### 5. (Optional) RBAC Groups

Create groups in Authentik for role mapping:

| Group Name           | TailDeck Role |
| -------------------- | ------------- |
| `TailDeck Admins`    | ADMIN         |
| `TailDeck Operators` | OPERATOR      |
| `TailDeck Auditors`  | AUDITOR       |
| `TailDeck Users`     | USER          |

---

## Environment Variables

### Required Variables

| Variable                | Description                        | Example                                         |
| ----------------------- | ---------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string       | `postgresql://user:pass@localhost:5432/db`      |
| `AUTH_SECRET`           | Session encryption key (32+ chars) | `<openssl rand -base64 32>`                     |
| `AUTH_URL`              | TailDeck's public URL              | `http://localhost:3000`                         |
| `AUTH_AUTHENTIK_ID`     | Authentik client ID                | `taildeck`                                      |
| `AUTH_AUTHENTIK_SECRET` | Authentik client secret            | `<from Authentik>`                              |
| `AUTH_AUTHENTIK_ISSUER` | Authentik OIDC issuer URL          | `http://localhost:9000/application/o/taildeck/` |
| `HEADSCALE_URL`         | Headscale API URL                  | `http://localhost:8080`                         |
| `HEADSCALE_API_KEY`     | Headscale API key                  | `<from headscale apikeys create>`               |

### Optional Variables

| Variable                    | Description                        | Default |
| --------------------------- | ---------------------------------- | ------- |
| `LOG_LEVEL`                 | Logging verbosity                  | `info`  |
| `AUTHENTIK_URL`             | Authentik base URL (for bootstrap) | -       |
| `AUTHENTIK_BOOTSTRAP_TOKEN` | API token for auto-configuration   | -       |
| `LOKI_URL`                  | Loki URL for flow logs             | -       |
| `LOKI_TENANT_ID`            | Loki tenant ID                     | -       |
| `LOKI_USERNAME`             | Loki basic auth username           | -       |
| `LOKI_PASSWORD`             | Loki basic auth password           | -       |

---

## Web Setup Wizard

After deploying TailDeck, access the setup wizard at `/setup` (requires OWNER role).

### Wizard Steps

1. **Welcome & Health Check**
   - Verifies Database, Headscale, and OIDC connectivity
   - Shows latency and service status

2. **Domain Configuration**
   - Review AUTH_URL and HEADSCALE_URL
   - Guidance for production URLs

3. **DNS & MagicDNS**
   - MagicDNS configuration
   - DNS over HTTPS settings
   - Base domain configuration

4. **Security Review**
   - Checks for HTTPS usage
   - Validates secret strength
   - Warns about default credentials
   - Dismissible warnings vs blocking issues

5. **Completion**
   - Summary of configuration
   - Links to next steps
   - Marks setup as complete

### Security Warnings

The wizard checks for common issues:

| Warning                    | Severity | Can Dismiss |
| -------------------------- | -------- | ----------- |
| Using HTTP in production   | Critical | No          |
| Weak AUTH_SECRET (< 32ch)  | Critical | No          |
| Default secrets detected   | Critical | No          |
| Missing OIDC configuration | Critical | No          |
| HTTP in development        | Info     | Yes         |

---

## Flow Logs Configuration

TailDeck supports Loki for network flow log visualization.

### Basic Setup

```env
LOKI_URL="http://localhost:3100"
```

### With Authentication

```env
LOKI_URL="https://loki.yourdomain.com"
LOKI_USERNAME="taildeck"
LOKI_PASSWORD="your-password"
```

### Multi-tenant Loki

```env
LOKI_URL="https://loki.yourdomain.com"
LOKI_TENANT_ID="taildeck"
```

---

## Troubleshooting

### Services Won't Start

```bash
docker compose ps
docker compose logs -f
docker compose down && docker compose up -d
```

### Database Connection Errors

```bash
docker compose ps postgres
docker exec taildeck-postgres pg_isready -U taildeck

# Reset database (WARNING: deletes data)
docker compose down -v
docker compose up -d
npm run db:push && npm run db:seed
```

### Authentik Login Fails

1. Check redirect URI matches exactly (no trailing slash):

   ```
   http://localhost:3000/api/auth/callback/authentik
   ```

2. Check issuer URL ends with `/`:

   ```
   http://localhost:9000/application/o/taildeck/
   ```

3. Verify client secret in `.env.local`

### Headscale Connection Errors

```bash
docker compose ps headscale
docker compose logs headscale
docker exec headscale headscale apikeys create --expiration 365d
```

### Port Conflicts

```bash
lsof -i :3000 -i :5432 -i :8080 -i :9000
```

If you have port conflicts with existing services, all ports are configurable via environment variables. Add these to your `.env.local`:

| Service           | Default Port | Environment Variable     |
| ----------------- | ------------ | ------------------------ |
| TailDeck App      | 3000         | `TAILDECK_PORT`          |
| Authentik HTTP    | 9000         | `AUTHENTIK_HTTP_PORT`    |
| Authentik HTTPS   | 9443         | `AUTHENTIK_HTTPS_PORT`   |
| Headscale API     | 8080         | `HEADSCALE_API_PORT`     |
| Headscale Metrics | 9090         | `HEADSCALE_METRICS_PORT` |
| NetFlow (UDP)     | 2055         | `NETFLOW_PORT`           |
| sFlow (UDP)       | 6343         | `SFLOW_PORT`             |
| IPFIX (UDP)       | 4739         | `IPFIX_PORT`             |

Example: To move Authentik to port 9001:

```bash
AUTHENTIK_HTTP_PORT=9001
```

**Note:** PostgreSQL (5432) is exposed for development convenience. For production, consider not exposing it to the host or using internal Docker networking only.

### Reset Everything

```bash
./scripts/cleanup.sh
./scripts/setup.sh
```

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Browser      │────▶│    TailDeck     │────▶│    Headscale    │
│                 │     │   (Next.js)     │     │   (VPN Coord)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │     │    Authentik    │     │     GoFlow2     │
│   (TailDeck)    │     │   (OIDC/Auth)   │     │  (Flow Collect) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Getting Help

- **Developer Docs**: See [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Issues**: https://github.com/dustinnh/taildeck/issues
- **Headscale Docs**: https://headscale.net/
- **Authentik Docs**: https://goauthentik.io/docs/
