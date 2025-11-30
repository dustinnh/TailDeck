#!/bin/bash
#
# TailDeck Setup Script
#
# This script automates the initial setup of TailDeck development environment.
# Run with: ./scripts/setup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

header() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN} $1${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
}

# Check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is required but not installed."
        exit 1
    fi
}

# Wait for a service to be healthy
wait_for_service() {
    local service=$1
    local max_attempts=${2:-30}
    local attempt=1

    log_info "Waiting for $service to be healthy..."
    while [ $attempt -le $max_attempts ]; do
        if docker compose ps "$service" 2>/dev/null | grep -q "healthy"; then
            log_success "$service is healthy"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""
    log_error "$service did not become healthy in time"
    return 1
}

# Wait for HTTP endpoint
wait_for_http() {
    local url=$1
    local max_attempts=${2:-30}
    local attempt=1

    log_info "Waiting for $url to be available..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302\|301"; then
            log_success "$url is available"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""
    log_warn "$url not responding yet (may still be initializing)"
    return 1
}

###########################################
# Main Setup Flow
###########################################

header "TailDeck Development Setup"

# Check prerequisites
log_info "Checking prerequisites..."
check_command docker
check_command docker compose 2>/dev/null || check_command "docker-compose"
check_command node
check_command npm
check_command curl
log_success "All prerequisites found"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js 18+ is required (found v$(node -v))"
    exit 1
fi
log_success "Node.js version OK ($(node -v))"

# Ensure we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "docker-compose.yml" ]; then
    log_error "Please run this script from the TailDeck root directory"
    exit 1
fi

###########################################
# Step 1: Environment Setup
###########################################
header "Step 1: Environment Configuration"

if [ -f ".env.local" ]; then
    log_warn ".env.local already exists"
    read -p "Do you want to overwrite it? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Keeping existing .env.local"
    else
        rm .env.local
    fi
fi

if [ ! -f ".env.local" ]; then
    log_info "Creating .env.local from template..."
    cp .env.example .env.local

    # Generate AUTH_SECRET
    AUTH_SECRET=$(openssl rand -base64 32)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|generate-a-secret-with-openssl-rand-base64-32|$AUTH_SECRET|" .env.local
    else
        sed -i "s|generate-a-secret-with-openssl-rand-base64-32|$AUTH_SECRET|" .env.local
    fi
    log_success "Generated AUTH_SECRET"
fi

###########################################
# Step 2: Install Dependencies
###########################################
header "Step 2: Installing Node Dependencies"

if [ ! -d "node_modules" ]; then
    log_info "Installing npm packages..."
    npm install
    log_success "Dependencies installed"
else
    log_info "node_modules exists, running npm install to ensure up-to-date..."
    npm install
fi

###########################################
# Step 3: Start Docker Services
###########################################
header "Step 3: Starting Docker Services"

log_info "Starting Docker containers..."
docker compose up -d

# Wait for databases
wait_for_service "postgres" 60
wait_for_service "authentik-postgres" 60
wait_for_service "redis" 30

# Wait for Authentik (takes longer to initialize)
log_info "Waiting for Authentik to initialize (this may take 1-2 minutes)..."
sleep 10
wait_for_http "http://localhost:9000" 60

log_success "All Docker services are running"

###########################################
# Step 4: Generate Headscale API Key
###########################################
header "Step 4: Headscale API Key"

log_info "Waiting for Headscale to be ready..."
sleep 5

# Check if HEADSCALE_API_KEY is already set (not placeholder)
if grep -q "your-headscale-api-key" .env.local; then
    log_info "Generating Headscale API key..."
    HEADSCALE_KEY=$(docker exec headscale headscale apikeys create --expiration 365d 2>/dev/null || echo "")

    if [ -n "$HEADSCALE_KEY" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|your-headscale-api-key|$HEADSCALE_KEY|" .env.local
        else
            sed -i "s|your-headscale-api-key|$HEADSCALE_KEY|" .env.local
        fi
        log_success "Headscale API key generated and saved"
    else
        log_warn "Could not generate Headscale API key automatically"
        log_info "Run manually: docker exec headscale headscale apikeys create"
    fi
else
    log_info "Headscale API key already configured"
fi

###########################################
# Step 5: Database Setup
###########################################
header "Step 5: Database Setup"

log_info "Generating Prisma client..."
npm run db:generate

log_info "Pushing database schema..."
npm run db:push

log_info "Seeding database with roles and permissions..."
npm run db:seed

log_success "Database setup complete"

###########################################
# Step 6: Authentik Configuration
###########################################
header "Step 6: Authentik OIDC Setup"

echo ""
echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${YELLOW}│  MANUAL STEP REQUIRED: Configure Authentik                  │${NC}"
echo -e "${YELLOW}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""
echo "Authentik requires manual configuration through its web UI."
echo ""
echo -e "${BLUE}1. Open Authentik:${NC} http://localhost:9000/if/flow/initial-setup/"
echo ""
echo -e "${BLUE}2. Create admin account${NC} (first time only)"
echo ""
echo -e "${BLUE}3. Go to Admin Interface:${NC} http://localhost:9000/admin/"
echo ""
echo -e "${BLUE}4. Create OAuth2 Provider:${NC}"
echo "   - Navigate to: Applications > Providers > Create"
echo "   - Type: OAuth2/OpenID Provider"
echo "   - Name: taildeck"
echo "   - Authorization flow: default-provider-authorization-implicit-consent"
echo "   - Client ID: taildeck"
echo "   - Client Secret: (copy this value)"
echo "   - Redirect URIs: http://localhost:3000/api/auth/callback/authentik"
echo "   - Scopes: openid, profile, email"
echo ""
echo -e "${BLUE}5. Create Application:${NC}"
echo "   - Navigate to: Applications > Applications > Create"
echo "   - Name: TailDeck"
echo "   - Slug: taildeck"
echo "   - Provider: taildeck (the one you just created)"
echo ""
echo -e "${BLUE}6. Update .env.local:${NC}"
echo "   - Set AUTH_AUTHENTIK_SECRET to the client secret from step 4"
echo ""
echo -e "${BLUE}7. (Optional) Create Groups for RBAC:${NC}"
echo "   - Navigate to: Directory > Groups"
echo "   - Create groups: OWNER, ADMIN, OPERATOR, AUDITOR"
echo "   - Assign users to groups for automatic role assignment"
echo ""

###########################################
# Summary
###########################################
header "Setup Complete!"

echo -e "${GREEN}TailDeck infrastructure is ready!${NC}"
echo ""
echo "Services running:"
echo "  - PostgreSQL:  localhost:5432"
echo "  - Authentik:   http://localhost:9000"
echo "  - Headscale:   http://localhost:8080"
echo ""
echo "Next steps:"
echo "  1. Complete Authentik OIDC setup (see instructions above)"
echo "  2. Update AUTH_AUTHENTIK_SECRET in .env.local"
echo "  3. Start the development server:"
echo ""
echo -e "     ${GREEN}npm run dev${NC}"
echo ""
echo "  4. Open http://localhost:3000"
echo "  5. Sign in with Authentik - first user becomes OWNER"
echo ""
echo "Useful commands:"
echo "  - View logs:      docker compose logs -f"
echo "  - Stop services:  docker compose down"
echo "  - Reset all:      docker compose down -v && ./scripts/setup.sh"
echo ""
log_success "Happy coding!"
