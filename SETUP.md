# TailDeck Setup Guide

Complete guide to setting up TailDeck for development or production.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Authentik Configuration](#authentik-configuration)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

For the fastest setup experience:

```bash
# Clone the repository
git clone https://github.com/yourusername/taildeck.git
cd taildeck

# Run the setup script
./scripts/setup.sh
```

The setup script will:

1. Check prerequisites (Docker, Node.js 18+)
2. Create `.env.local` from template
3. Generate `AUTH_SECRET`
4. Start Docker services
5. Generate Headscale API key
6. Set up the database

After the script completes, you'll need to [configure Authentik](#authentik-configuration) manually.

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

## Development Setup

### Step 1: Clone and Install

```bash
git clone https://github.com/yourusername/taildeck.git
cd taildeck
npm install
```

### Step 2: Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env.local

# Generate a secure AUTH_SECRET
openssl rand -base64 32
# Copy the output and paste it as AUTH_SECRET in .env.local
```

### Step 3: Start Infrastructure

```bash
# Start PostgreSQL, Authentik, Redis, and Headscale
docker compose up -d

# Wait for services to be healthy (about 1-2 minutes)
docker compose ps
```

### Step 4: Generate Headscale API Key

```bash
# Generate an API key for TailDeck to communicate with Headscale
docker exec headscale headscale apikeys create --expiration 365d

# Copy the output and paste it as HEADSCALE_API_KEY in .env.local
```

### Step 5: Configure Authentik

See [Authentik Configuration](#authentik-configuration) below.

### Step 6: Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Create database tables
npm run db:push

# Seed roles and permissions
npm run db:seed
```

### Step 7: Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 and sign in with Authentik. The first user becomes OWNER.

---

## Production Setup

For production, you can run everything in Docker:

### Option A: Full Docker Stack

```bash
# Build and start all services including TailDeck
docker compose --profile app up -d --build

# Run database migrations
docker exec taildeck-app npx prisma db push
docker exec taildeck-app npx prisma db seed
```

### Option B: External App Server

Run TailDeck on a separate server while using Docker for infrastructure:

```bash
# On infrastructure server
docker compose up -d

# On app server
npm ci
npm run build
npm start
```

### Production Environment Variables

For production, ensure you set:

```env
# Strong random secret
AUTH_SECRET="<generate with: openssl rand -base64 32>"

# Production URLs
AUTH_URL="https://taildeck.yourdomain.com"
AUTH_AUTHENTIK_ISSUER="https://auth.yourdomain.com/application/o/taildeck/"

# Headscale URL (internal or external)
HEADSCALE_URL="https://headscale.yourdomain.com"
```

---

## Authentik Configuration

Authentik requires manual setup through its web interface. This is a one-time configuration.

### 1. Initial Setup

1. Open http://localhost:9000/if/flow/initial-setup/
2. Create your admin account
3. Complete the setup wizard

### 2. Create OAuth2 Provider

1. Go to **Admin Interface**: http://localhost:9000/admin/
2. Navigate to **Applications** → **Providers**
3. Click **Create**
4. Select **OAuth2/OpenID Provider**
5. Configure:

| Field              | Value                                               |
| ------------------ | --------------------------------------------------- |
| Name               | `taildeck`                                          |
| Authorization flow | `default-provider-authorization-implicit-consent`   |
| Client type        | `Confidential`                                      |
| Client ID          | `taildeck`                                          |
| Client Secret      | (click copy - save this!)                           |
| Redirect URIs      | `http://localhost:3000/api/auth/callback/authentik` |
| Signing Key        | `authentik Self-signed Certificate`                 |

6. Under **Advanced protocol settings**:
   - Scopes: `openid`, `profile`, `email`

7. Click **Create**

### 3. Create Application

1. Navigate to **Applications** → **Applications**
2. Click **Create**
3. Configure:

| Field    | Value                                      |
| -------- | ------------------------------------------ |
| Name     | `TailDeck`                                 |
| Slug     | `taildeck`                                 |
| Provider | `taildeck` (the provider you just created) |

4. Click **Create**

### 4. Update Environment

Add the client secret to your `.env.local`:

```env
AUTH_AUTHENTIK_SECRET="<paste the client secret from step 2>"
```

### 5. (Optional) Create RBAC Groups

TailDeck can sync Authentik groups to roles:

1. Navigate to **Directory** → **Groups**
2. Create groups for each role:
   - `OWNER` - Full system access
   - `ADMIN` - Administrative access
   - `OPERATOR` - Machine management
   - `AUDITOR` - Read-only audit access

When users are added to these groups, they'll automatically get the corresponding TailDeck role.

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

| Variable    | Description       | Default |
| ----------- | ----------------- | ------- |
| `LOG_LEVEL` | Logging verbosity | `info`  |

---

## Troubleshooting

### Services won't start

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f

# Restart all services
docker compose down && docker compose up -d
```

### Database connection errors

```bash
# Ensure PostgreSQL is healthy
docker compose ps postgres

# Test connection
docker exec taildeck-postgres pg_isready -U taildeck

# Reset database
docker compose down -v  # WARNING: Deletes all data
docker compose up -d
npm run db:push
npm run db:seed
```

### Authentik login fails

1. Verify the redirect URI matches exactly:
   - Configured: `http://localhost:3000/api/auth/callback/authentik`
   - No trailing slash!

2. Check the issuer URL ends with `/`:
   - Correct: `http://localhost:9000/application/o/taildeck/`
   - Wrong: `http://localhost:9000/application/o/taildeck`

3. Ensure the client secret is correct in `.env.local`

### Headscale connection errors

```bash
# Check Headscale is running
docker compose ps headscale

# View Headscale logs
docker compose logs headscale

# Regenerate API key
docker exec headscale headscale apikeys create --expiration 365d
```

### Port conflicts

If ports are already in use:

```bash
# Check what's using a port
lsof -i :3000
lsof -i :5432
lsof -i :8080
lsof -i :9000

# Stop the conflicting process or change ports in docker-compose.yml
```

### Reset Everything

```bash
# Nuclear option - removes all data
docker compose down -v
rm -rf node_modules .next
rm .env.local

# Start fresh
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
│   PostgreSQL    │     │    Authentik    │     │      Redis      │
│   (TailDeck)    │     │   (OIDC/Auth)   │     │   (Authentik)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Getting Help

- **Documentation**: See `CLAUDE.md` for developer documentation
- **Issues**: https://github.com/yourusername/taildeck/issues
- **Headscale Docs**: https://headscale.net/
- **Authentik Docs**: https://goauthentik.io/docs/
