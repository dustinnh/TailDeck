# TailDeck Installation Walkthrough

A complete step-by-step guide to installing TailDeck from scratch. This guide assumes you're starting fresh with no prior configuration.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Run the Setup Script](#3-run-the-setup-script)
4. [Configure Authentik](#4-configure-authentik)
5. [Start TailDeck](#5-start-taildeck)
6. [Complete the Web Setup Wizard](#6-complete-the-web-setup-wizard)
7. [First Login](#7-first-login)
8. [Next Steps](#8-next-steps)
9. [Cleanup & Reset](#9-cleanup--reset)

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
git clone https://github.com/yourusername/taildeck.git
cd taildeck
```

---

## 3. Run the Setup Script

The interactive setup script handles most of the configuration:

```bash
./scripts/setup.sh
```

### What the Script Does

1. **Pre-flight Checks**: Verifies Docker, Node.js, and port availability
2. **Configuration Prompts**: Asks for domain name, Headscale URL, etc.
3. **Environment Setup**: Creates `.env.local` with your configuration
4. **Docker Services**: Starts PostgreSQL, Authentik, Redis, and Headscale
5. **Secrets Generation**: Creates secure `AUTH_SECRET` and other tokens
6. **Headscale Config**: Generates `headscale/config.yaml` from template
7. **API Key**: Creates Headscale API key automatically
8. **Database Setup**: Runs migrations and seeds initial data

### Example Setup Session

```
╔════════════════════════════════════════════════════════════════╗
║              TailDeck Interactive Setup                        ║
╚════════════════════════════════════════════════════════════════╝

[1/6] Running pre-flight checks...
  ✓ Docker is installed
  ✓ Docker Compose is installed
  ✓ Node.js is installed (v20.10.0)
  ✓ All required ports are available

[2/6] Collecting configuration...

Enter your domain name (e.g., taildeck.example.com):
> taildeck.local

Enter the public URL for TailDeck (e.g., https://taildeck.example.com):
> http://localhost:3000

Enter the public URL for Headscale (e.g., https://headscale.example.com):
> http://localhost:8080

Enable MagicDNS? (y/n) [y]:
> y

Enter the MagicDNS base domain [taildeck.local]:
>

[3/6] Creating environment file...
  ✓ Generated AUTH_SECRET
  ✓ Created .env.local

[4/6] Starting Docker services...
  ✓ PostgreSQL started
  ✓ Redis started
  ✓ Headscale started
  ✓ Authentik started

[5/6] Generating Headscale API key...
  ✓ API key generated and saved to .env.local

[6/6] Setting up database...
  ✓ Prisma client generated
  ✓ Database schema pushed
  ✓ Initial data seeded

╔════════════════════════════════════════════════════════════════╗
║              Setup Complete!                                   ║
╚════════════════════════════════════════════════════════════════╝

Next steps:
1. Configure Authentik at http://localhost:9000
2. Run: npm run dev
3. Open http://localhost:3000
```

---

## 4. Configure Authentik

After the setup script completes, you need to configure Authentik for OIDC authentication.

### 4.1 Initial Authentik Setup

1. Open http://localhost:9000/if/flow/initial-setup/
2. Create your admin account (save these credentials!)
3. Complete the initial setup wizard

### 4.2 Create OAuth2 Provider

1. Go to **Admin Interface**: http://localhost:9000/admin/
2. Navigate to **Applications** → **Providers**
3. Click **Create**
4. Select **OAuth2/OpenID Provider**
5. Configure with these settings:

| Setting            | Value                                               |
| ------------------ | --------------------------------------------------- |
| Name               | `TailDeck OAuth2`                                   |
| Authorization flow | `default-provider-authorization-implicit-consent`   |
| Client type        | `Confidential`                                      |
| Client ID          | `taildeck`                                          |
| Client Secret      | Click regenerate, then **copy this value**          |
| Redirect URIs      | `http://localhost:3000/api/auth/callback/authentik` |
| Signing Key        | `authentik Self-signed Certificate`                 |

6. Under **Advanced protocol settings**, ensure scopes include: `openid`, `profile`, `email`
7. Click **Create**

### 4.3 Create Application

1. Navigate to **Applications** → **Applications**
2. Click **Create**
3. Configure:

| Setting  | Value                                        |
| -------- | -------------------------------------------- |
| Name     | `TailDeck`                                   |
| Slug     | `taildeck`                                   |
| Provider | `TailDeck OAuth2` (the provider you created) |

4. Click **Create**

### 4.4 Update Environment

Add the client secret to your `.env.local`:

```bash
# Open your .env.local and update this line:
AUTH_AUTHENTIK_SECRET="paste-the-client-secret-here"
```

Or use sed:

```bash
sed -i 's/your-authentik-client-secret/PASTE_YOUR_SECRET/' .env.local
```

---

## 5. Start TailDeck

```bash
# Install dependencies (if not done already)
npm install

# Start the development server
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

---

## 6. Complete the Web Setup Wizard

1. Open http://localhost:3000 in your browser
2. You'll be redirected to Authentik to sign in
3. After signing in, navigate to `/setup` or look for the setup prompt on the dashboard

The web wizard walks you through:

1. **Welcome**: Verifies all services are healthy
   - Database connection ✓
   - Headscale API ✓
   - OIDC provider ✓

2. **Domain Configuration**: Review your domain settings

3. **DNS & MagicDNS**: Configure DNS settings
   - MagicDNS base domain
   - DNS over HTTPS settings

4. **Security Review**: Address any warnings
   - HTTP vs HTTPS warnings
   - Weak secrets detection
   - Missing configuration alerts

5. **Complete Setup**: Finalize the installation

---

## 7. First Login

After completing the setup wizard:

1. The **first user to sign in** automatically becomes **OWNER**
2. OWNER has full system access and can:
   - Manage all machines and routes
   - Configure ACL policies
   - Manage API keys
   - Assign roles to other users

### Creating Additional Users

1. Have new users sign in through Authentik
2. Go to **Settings** in TailDeck
3. Assign appropriate roles (ADMIN, OPERATOR, AUDITOR, USER)

---

## 8. Next Steps

### Add Your First Machine

1. Go to **Devices** → **Add Device**
2. Copy the join command for your platform
3. Run on your device to connect to your Headscale network

### Configure ACL Policies

1. Go to **Policies**
2. Edit the default policy or create custom rules
3. Control which devices can communicate

### Enable Flow Logs (Optional)

For network flow visibility, configure Loki:

1. Add Loki configuration to `.env.local`:
   ```env
   LOKI_URL="http://localhost:3100"
   ```
2. Deploy Loki container
3. Access **Flow Logs** in TailDeck

---

## 9. Cleanup & Reset

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

## Troubleshooting

### Docker Services Won't Start

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f authentik
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

### Headscale Connection Errors

```bash
# Check Headscale is running
docker compose ps headscale

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

---

## Getting Help

- **Issues**: https://github.com/yourusername/taildeck/issues
- **Headscale Docs**: https://headscale.net/
- **Authentik Docs**: https://goauthentik.io/docs/
- **Setup Reference**: See [SETUP.md](./SETUP.md) for detailed configuration options
- **Developer Docs**: See [CONTRIBUTING.md](./CONTRIBUTING.md) for architecture details
