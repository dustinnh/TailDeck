# TailDeck Installation Walkthrough

A complete step-by-step guide to installing TailDeck from scratch. This guide assumes you're starting fresh with no prior configuration.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Run the Setup Script](#3-run-the-setup-script)
4. [Complete Authentik Initial Setup](#4-complete-authentik-initial-setup)
5. [Start TailDeck](#5-start-taildeck)
6. [First Login](#6-first-login)
7. [Next Steps](#7-next-steps)
8. [Cleanup & Reset](#8-cleanup--reset)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

### Required Software

```bash
# Check Docker version (need 20.10+)
docker --version

# Check Docker Compose version (need 2.0+)
docker compose version

# Check Node.js version (need 18.0+)
node --version

# Check npm version (need 9.0+)
npm --version
```

### System Requirements

- **RAM**: 4GB minimum (8GB recommended)
- **Disk**: 10GB free space
- **Ports available**: 3000, 5432, 8080, 9000

Check if ports are in use:

```bash
lsof -i :3000 -i :5432 -i :8080 -i :9000
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/dustinnh/taildeck.git
cd taildeck
```

---

## 3. Run the Setup Script

The interactive setup script handles the entire configuration process:

```bash
./scripts/setup.sh
```

### Quick Mode (Development)

For a fast setup with development defaults:

```bash
./scripts/setup.sh --quick
```

### Script Options

```bash
./scripts/setup.sh [options]

Options:
  --quick, -q       Quick mode with defaults (development)
  --skip-authentik  Skip automatic Authentik OIDC configuration
  --skip-docker     Skip Docker service management
  --help, -h        Show help message
```

### What the Script Does (9 Steps)

The setup script automates these steps:

| Step                            | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| 1. Pre-flight Checks            | Verifies Docker, Node.js, and port availability           |
| 2. Environment Configuration    | Creates `.env.local`, generates secrets, configures URLs  |
| 3. Installing Dependencies      | Runs `npm install`                                        |
| 4. Headscale Configuration      | Generates `headscale/config.yaml` from template           |
| 5. Starting Docker Services     | Starts PostgreSQL, Redis, Authentik, Headscale, GoFlow2   |
| 6. Generating Headscale API Key | Creates API key and updates `.env.local`                  |
| 7. Database Setup               | Runs Prisma migrations and seeds roles/permissions        |
| 8. Authentik OIDC Configuration | **Automatically** creates OAuth2 provider and application |
| 9. Production Build             | (Production mode only) Runs `npm run build`               |

### Example Setup Session

```
╔════════════════════════════════════════════════════════════════╗
║              TailDeck Setup                                    ║
╚════════════════════════════════════════════════════════════════╝

Welcome to TailDeck - the Headscale Admin Dashboard!

This wizard will guide you through the setup process.

[1/9] Pre-flight Checks
  ✓ Docker is installed
  ✓ Docker Compose is installed
  ✓ Node.js is installed (v20.10.0)
  ✓ All required ports are available

[2/9] Environment Configuration
  ✓ Generated AUTH_SECRET
  ✓ Set AUTH_URL to http://localhost:3000
  ✓ Set AUTH_AUTHENTIK_ISSUER
  ✓ Set HEADSCALE_URL
  ✓ Generated AUTHENTIK_BOOTSTRAP_TOKEN

[3/9] Installing Dependencies
  ✓ Dependencies installed

[4/9] Headscale Configuration
  ✓ Generated headscale/config.yaml

[5/9] Starting Docker Services
  ✓ PostgreSQL started
  ✓ Redis started
  ✓ Authentik started
  ✓ Headscale started
  ✓ GoFlow2 started

[6/9] Generating Headscale API Key
  ✓ API key generated and saved to .env.local
  ✓ Created default Headscale user

[7/9] Database Setup
  ✓ Prisma client generated
  ✓ Database schema pushed
  ✓ Initial data seeded

[8/9] Authentik OIDC Configuration
  ✓ Created OAuth2 provider
  ✓ Created TailDeck application
  ✓ Created RBAC groups
  ✓ Updated AUTH_AUTHENTIK_SECRET

╔════════════════════════════════════════════════════════════════╗
║              Setup Complete!                                   ║
╚════════════════════════════════════════════════════════════════╝

TailDeck is ready!

Services (internal):
  - PostgreSQL:  localhost:5432
  - Authentik:   http://localhost:9000
  - Headscale:   http://localhost:8080

Next Steps:
  1. Complete Authentik initial setup:
     http://localhost:9000/if/flow/initial-setup/

  2. Start the development server:

     npm run dev

  3. Open http://localhost:3000
  4. Sign in with Authentik - first user becomes OWNER
```

---

## 4. Complete Authentik Initial Setup

After the setup script completes, you need to create your Authentik admin account:

1. Open http://localhost:9000/if/flow/initial-setup/
2. Create your admin account (save these credentials!)
3. Complete the initial setup wizard

**Note**: The setup script has already configured the OAuth2 provider and TailDeck application automatically. You do **not** need to create these manually.

### Manual Authentik Configuration (Only if --skip-authentik was used)

If you ran the setup script with `--skip-authentik`, you'll need to configure Authentik manually:

<details>
<summary>Click to expand manual configuration steps</summary>

#### Create OAuth2 Provider

1. Go to **Admin Interface**: http://localhost:9000/admin/
2. Navigate to **Applications** → **Providers**
3. Click **Create** → **OAuth2/OpenID Provider**
4. Configure:

| Setting            | Value                                               |
| ------------------ | --------------------------------------------------- |
| Name               | `TailDeck OAuth2`                                   |
| Authorization flow | `default-provider-authorization-implicit-consent`   |
| Client type        | `Confidential`                                      |
| Client ID          | `taildeck`                                          |
| Client Secret      | Click regenerate, then **copy this value**          |
| Redirect URIs      | `http://localhost:3000/api/auth/callback/authentik` |
| Signing Key        | `authentik Self-signed Certificate`                 |

5. Under **Advanced protocol settings**, ensure scopes include: `openid`, `profile`, `email`
6. Click **Create**

#### Create Application

1. Navigate to **Applications** → **Applications**
2. Click **Create**
3. Configure:

| Setting  | Value                                        |
| -------- | -------------------------------------------- |
| Name     | `TailDeck`                                   |
| Slug     | `taildeck`                                   |
| Provider | `TailDeck OAuth2` (the provider you created) |

4. Click **Create**

#### Update Environment

Add the client secret to your `.env.local`:

```bash
AUTH_AUTHENTIK_SECRET="paste-the-client-secret-here"
```

</details>

---

## 5. Start TailDeck

### Development Mode

```bash
npm run dev
```

You should see:

```
> taildeck@0.1.0 dev
> next dev

  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Ready in 2.3s
```

### Production Mode

If you selected production mode during setup:

```bash
npm run build
npm start
```

---

## 6. First Login

1. Open http://localhost:3000 (or your production URL)
2. You'll be redirected to Authentik to sign in
3. Use the admin account you created in step 4

**Important**: The **first user to sign in** automatically becomes **OWNER** with full system access.

### Role Hierarchy

| Role     | Permissions                                      |
| -------- | ------------------------------------------------ |
| OWNER    | Full access, API key management, system settings |
| ADMIN    | Settings, policies, DNS, user management         |
| OPERATOR | Machine management, routes, tags                 |
| AUDITOR  | Read-only access to audit logs                   |
| USER     | View own devices only (user portal)              |

---

## 7. Next Steps

### Add Your First Machine

1. Go to **Devices** → **Add Device**
2. Copy the join command for your platform
3. Run on your device to connect to your Headscale network

### Configure ACL Policies

1. Go to **Policies**
2. Edit the default policy or create custom rules
3. Control which devices can communicate

### Enable NetFlow Collection (Optional)

For network flow visibility, install softflowd on your Tailscale nodes:

```bash
# On each Tailscale node you want to monitor
sudo apt install softflowd
sudo softflowd -i tailscale0 -n YOUR_TAILDECK_SERVER:2055 -v 9
```

See **[docs/NETFLOW_SETUP.md](./docs/NETFLOW_SETUP.md)** for detailed instructions.

### Production Deployment

For production deployments with HTTPS:

1. Set up a reverse proxy (Caddy, nginx)
2. Update `.env.local` with external URLs:
   - `AUTH_URL` - Your TailDeck URL (e.g., `https://taildeck.example.com`)
   - `AUTH_AUTHENTIK_ISSUER` - Your Authentik URL (e.g., `https://auth.example.com/application/o/taildeck/`)
   - `HEADSCALE_URL` - Your Headscale URL (e.g., `https://headscale.example.com`)
3. Rebuild: `npm run build`

See **[SETUP.md](./SETUP.md)** for detailed production configuration.

---

## 8. Cleanup & Reset

To start completely fresh (removes all data):

```bash
./scripts/cleanup.sh
```

This removes:

- All Docker containers
- All Docker volumes (database data)
- Configuration files (`.env`, `.env.local`)
- Build artifacts (`.next`)
- Generated configs (`headscale/config.yaml`)

Then run `./scripts/setup.sh` again for a fresh installation.

---

## 9. Troubleshooting

### Docker Services Won't Start

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f authentik-server
docker compose logs -f headscale
docker compose logs -f postgres
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Test connection
docker exec taildeck-postgres pg_isready -U taildeck
```

### Authentik Login Fails

1. **Check redirect URI** matches exactly (no trailing slash):

   ```
   http://localhost:3000/api/auth/callback/authentik
   ```

2. **Check issuer URL** ends with `/`:

   ```
   http://localhost:9000/application/o/taildeck/
   ```

3. **Verify client secret** is correct in `.env.local`

4. **Re-run auto-configuration** if needed:
   ```bash
   AUTHENTIK_URL="http://localhost:9000" npx tsx scripts/setup-authentik.ts
   ```

### Headscale Connection Errors

```bash
# Check Headscale is running
docker compose ps headscale

# View Headscale logs
docker compose logs -f headscale

# Regenerate API key if needed
docker exec headscale headscale apikeys create --expiration 365d
```

### Port Conflicts

```bash
# Find what's using a port
lsof -i :3000
lsof -i :9000

# Kill the process or change port in docker-compose.yml
```

### Environment Variable Issues

If builds use wrong URLs after changing `.env.local`:

```bash
# Clear Next.js cache and rebuild
rm -rf .next
npm run build
```

---

## Getting Help

- **Website**: https://taildeck.org
- **Issues**: https://github.com/dustinnh/taildeck/issues
- **Headscale Docs**: https://headscale.net/
- **Authentik Docs**: https://goauthentik.io/docs/
- **Setup Reference**: See [SETUP.md](./SETUP.md) for detailed configuration options
- **Developer Docs**: See [CONTRIBUTING.md](./CONTRIBUTING.md) for architecture details
