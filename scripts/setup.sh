#!/bin/bash
#
# TailDeck Setup Script
#
# This script automates the initial setup of TailDeck with:
# - Interactive configuration prompts
# - Pre-flight validation checks
# - Docker service management
# - Automatic Authentik OIDC configuration
# - Headscale API key generation
# - Database initialization
#
# Usage:
#   ./scripts/setup.sh           # Interactive mode
#   ./scripts/setup.sh --quick   # Quick mode with defaults
#   ./scripts/setup.sh --help    # Show help
#

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source library files
source "$SCRIPT_DIR/lib/colors.sh"
source "$SCRIPT_DIR/lib/prompts.sh"
source "$SCRIPT_DIR/lib/validation.sh"
source "$SCRIPT_DIR/lib/docker.sh"
source "$SCRIPT_DIR/lib/headscale.sh"
source "$SCRIPT_DIR/lib/authentik.sh"

# Default configuration
QUICK_MODE=false
SKIP_AUTHENTIK=false
SKIP_DOCKER=false
TAILDECK_ENV="development"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick|-q)
            QUICK_MODE=true
            shift
            ;;
        --skip-authentik)
            SKIP_AUTHENTIK=true
            shift
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --help|-h)
            echo "TailDeck Setup Script"
            echo ""
            echo "Usage: ./scripts/setup.sh [options]"
            echo ""
            echo "Options:"
            echo "  --quick, -q       Quick mode with defaults (development)"
            echo "  --skip-authentik  Skip automatic Authentik configuration"
            echo "  --skip-docker     Skip Docker service management"
            echo "  --help, -h        Show this help message"
            echo ""
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Change to project directory
cd "$PROJECT_DIR"

###########################################
# Main Setup Flow
###########################################

header "TailDeck Setup"

echo -e "Welcome to TailDeck - the Headscale Admin Dashboard!"
echo ""
echo -e "This wizard will guide you through the setup process."
echo ""

# Check if running in quick mode
if [ "$QUICK_MODE" = true ]; then
    log_info "Running in quick mode with development defaults"
    TAILDECK_ENV="development"
    URL_SCHEME="http"
    TAILDECK_DOMAIN="localhost"
    AUTH_URL="http://localhost:3000"
    HEADSCALE_URL="http://localhost:8080"
    AUTHENTIK_PUBLIC_URL="http://localhost:9000"
    AUTH_AUTHENTIK_ISSUER="http://localhost:9000/application/o/taildeck/"
    MAGIC_DNS_ENABLED="true"
    MAGIC_DNS_DOMAIN="taildeck.local"
else
    # Run interactive configuration
    collect_setup_config
fi

###########################################
# Step 1: Pre-flight Checks
###########################################

step_init 9
step_next "Pre-flight Checks"

if ! preflight_checks; then
    log_error "Pre-flight checks failed. Please fix the issues above and try again."
    exit 1
fi

###########################################
# Step 2: Environment Configuration
###########################################

step_next "Environment Configuration"

if [ -f ".env.local" ]; then
    log_warn ".env.local already exists"

    if [ "$QUICK_MODE" = true ]; then
        log_info "Quick mode: keeping existing .env.local"
    else
        if prompt_confirm "Do you want to overwrite it?" "n"; then
            rm .env.local
        else
            log_info "Keeping existing .env.local"
        fi
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

    # Update AUTH_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|AUTH_URL=.*|AUTH_URL=\"${AUTH_URL}\"|" .env.local
    else
        sed -i "s|AUTH_URL=.*|AUTH_URL=\"${AUTH_URL}\"|" .env.local
    fi
    log_success "Set AUTH_URL to ${AUTH_URL}"

    # Update AUTH_AUTHENTIK_ISSUER (critical for OIDC in production)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|AUTH_AUTHENTIK_ISSUER=.*|AUTH_AUTHENTIK_ISSUER=\"${AUTH_AUTHENTIK_ISSUER}\"|" .env.local
    else
        sed -i "s|AUTH_AUTHENTIK_ISSUER=.*|AUTH_AUTHENTIK_ISSUER=\"${AUTH_AUTHENTIK_ISSUER}\"|" .env.local
    fi
    log_success "Set AUTH_AUTHENTIK_ISSUER to ${AUTH_AUTHENTIK_ISSUER}"
fi

# Generate Authentik bootstrap token if empty or not set
# Extract current value (handles both AUTHENTIK_BOOTSTRAP_TOKEN="" and AUTHENTIK_BOOTSTRAP_TOKEN="value")
CURRENT_TOKEN=$(grep "^AUTHENTIK_BOOTSTRAP_TOKEN=" .env.local 2>/dev/null | sed 's/^AUTHENTIK_BOOTSTRAP_TOKEN="//' | sed 's/"$//')

if [ -z "$CURRENT_TOKEN" ]; then
    AUTHENTIK_BOOTSTRAP_TOKEN=$(openssl rand -hex 32)

    # Update in place if the line exists, otherwise append
    if grep -q "^AUTHENTIK_BOOTSTRAP_TOKEN=" .env.local; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^AUTHENTIK_BOOTSTRAP_TOKEN=.*|AUTHENTIK_BOOTSTRAP_TOKEN=\"${AUTHENTIK_BOOTSTRAP_TOKEN}\"|" .env.local
        else
            sed -i "s|^AUTHENTIK_BOOTSTRAP_TOKEN=.*|AUTHENTIK_BOOTSTRAP_TOKEN=\"${AUTHENTIK_BOOTSTRAP_TOKEN}\"|" .env.local
        fi
    else
        echo "" >> .env.local
        echo "AUTHENTIK_BOOTSTRAP_TOKEN=\"${AUTHENTIK_BOOTSTRAP_TOKEN}\"" >> .env.local
    fi
    log_success "Generated AUTHENTIK_BOOTSTRAP_TOKEN"
    export AUTHENTIK_BOOTSTRAP_TOKEN
else
    AUTHENTIK_BOOTSTRAP_TOKEN="$CURRENT_TOKEN"
    log_info "Using existing AUTHENTIK_BOOTSTRAP_TOKEN"
    export AUTHENTIK_BOOTSTRAP_TOKEN
fi

# Source .env.local to get variables
set -a
source .env.local
set +a

###########################################
# Step 3: Install Dependencies
###########################################

step_next "Installing Dependencies"

if [ ! -d "node_modules" ]; then
    log_info "Installing npm packages..."
    npm install
    log_success "Dependencies installed"
else
    log_info "Updating npm packages..."
    npm install --prefer-offline
    log_success "Dependencies updated"
fi

###########################################
# Step 4: Generate Headscale Config
###########################################

step_next "Headscale Configuration"

# Generate Headscale config from template BEFORE starting Docker
# This is critical because Docker will fail if the config file doesn't exist
if [ -f "headscale/config.yaml.template" ]; then
    export HEADSCALE_PUBLIC_URL="${HEADSCALE_URL:-http://localhost:8080}"
    export LOG_LEVEL="info"
    generate_headscale_config "headscale/config.yaml.template" "headscale/config.yaml"
else
    log_warn "Headscale config template not found"
fi

###########################################
# Step 5: Start Docker Services
###########################################

step_next "Starting Docker Services"

if [ "$SKIP_DOCKER" = true ]; then
    log_info "Skipping Docker services (--skip-docker)"
else
    docker_up

    # Wait for all services
    wait_for_all_services

    docker_status
fi

###########################################
# Step 6: Generate Headscale API Key
###########################################

step_next "Generating Headscale API Key"

if [ "$SKIP_DOCKER" = true ]; then
    log_info "Skipping Headscale API key (Docker skipped)"
else
    # Check if HEADSCALE_API_KEY is already set (not placeholder)
    if grep -q "your-headscale-api-key" .env.local; then
        log_info "Generating Headscale API key..."
        sleep 5  # Give Headscale time to fully start

        HEADSCALE_KEY=$(generate_headscale_api_key "headscale" "365d")

        if [ -n "$HEADSCALE_KEY" ]; then
            update_env_headscale_key ".env.local" "$HEADSCALE_KEY"
            export HEADSCALE_API_KEY="$HEADSCALE_KEY"
        else
            log_warn "Could not generate Headscale API key automatically"
            log_info "Run manually: docker exec headscale headscale apikeys create"
        fi
    else
        log_info "Headscale API key already configured"
    fi

    # Create default Headscale user from admin email prefix
    if [ -n "$ADMIN_EMAIL" ]; then
        HEADSCALE_USERNAME="${ADMIN_EMAIL%%@*}"
    else
        # Fallback for quick mode
        HEADSCALE_USERNAME="admin"
    fi

    log_info "Creating default Headscale user: ${HEADSCALE_USERNAME}"
    create_headscale_user "headscale" "$HEADSCALE_USERNAME"

    show_headscale_info "headscale"
fi

###########################################
# Step 7: Database Setup
###########################################

step_next "Database Setup"

log_info "Generating Prisma client..."
npm run db:generate

log_info "Pushing database schema..."
npm run db:push

log_info "Seeding database with roles and permissions..."
npm run db:seed

log_success "Database setup complete"

###########################################
# Step 8: Authentik Configuration
###########################################

step_next "Authentik OIDC Configuration"

if [ "$SKIP_AUTHENTIK" = true ]; then
    log_info "Skipping Authentik auto-configuration (--skip-authentik)"
elif [ "$SKIP_DOCKER" = true ]; then
    log_info "Skipping Authentik setup (Docker skipped)"
elif [ -z "$AUTHENTIK_BOOTSTRAP_TOKEN" ]; then
    log_warn "AUTHENTIK_BOOTSTRAP_TOKEN not set - skipping auto-configuration"
else
    # Set up environment for Authentik script
    export AUTHENTIK_URL="http://localhost:9000"
    export AUTH_AUTHENTIK_ID="${AUTH_AUTHENTIK_ID:-taildeck}"

    log_info "Running Authentik auto-configuration..."

    # Run the TypeScript setup script
    if npx tsx scripts/setup-authentik.ts; then
        log_success "Authentik auto-configuration complete"
    else
        log_warn "Authentik auto-configuration had issues"
        log_info "You may need to configure Authentik manually"
    fi
fi

# Show manual instructions if auto-config was skipped
if [ "$SKIP_AUTHENTIK" = true ] || [ -z "$AUTHENTIK_BOOTSTRAP_TOKEN" ]; then
    echo ""
    box "Manual Authentik Configuration Required" "$YELLOW"
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
    echo "   - Name: TailDeck OAuth2"
    echo "   - Authorization flow: default-provider-authorization-implicit-consent"
    echo "   - Client ID: taildeck"
    echo "   - Client Secret: (copy this value)"
    echo "   - Redirect URIs: ${AUTH_URL}/api/auth/callback/authentik"
    echo "   - Scopes: openid, profile, email, groups"
    echo ""
    echo -e "${BLUE}5. Create Application:${NC}"
    echo "   - Navigate to: Applications > Applications > Create"
    echo "   - Name: TailDeck"
    echo "   - Slug: taildeck"
    echo "   - Provider: TailDeck OAuth2"
    echo ""
    echo -e "${BLUE}6. Update .env.local:${NC}"
    echo "   - Set AUTH_AUTHENTIK_SECRET to the client secret"
    echo ""
fi

###########################################
# Security Checks
###########################################

header "Security Review"

# Run security checks
security_checks "$AUTH_URL" "$AUTH_SECRET" "$TAILDECK_ENV"

###########################################
# Summary
###########################################

###########################################
# Step 9: Production Build (if applicable)
###########################################

if [ "$TAILDECK_ENV" = "production" ]; then
    step_next "Building for Production"

    log_info "Building TailDeck for production..."
    log_info "This ensures environment variables are baked into the build correctly."

    # Run the build
    if npm run build; then
        log_success "Production build complete"
    else
        log_error "Production build failed"
        log_info "Try running 'npm run build' manually after fixing any issues"
    fi
fi

header "Setup Complete!"

echo -e "${GREEN}TailDeck is ready!${NC}"
echo ""

echo -e "${BOLD}Services (internal):${NC}"
echo "  - PostgreSQL:  localhost:5432"
echo "  - Authentik:   http://localhost:9000"
echo "  - Headscale:   http://localhost:8080"
echo ""

echo -e "${BOLD}Configuration:${NC}"
echo "  - Environment: ${TAILDECK_ENV}"
echo "  - TailDeck URL: ${AUTH_URL}"
echo "  - Authentik URL: ${AUTHENTIK_PUBLIC_URL:-http://localhost:9000}"
echo "  - Headscale URL: ${HEADSCALE_URL}"
echo "  - MagicDNS: ${MAGIC_DNS_ENABLED}"
if [ "$MAGIC_DNS_ENABLED" = "true" ]; then
    echo "  - MagicDNS Domain: ${MAGIC_DNS_DOMAIN}"
fi
echo ""

echo -e "${BOLD}Next Steps:${NC}"

if [ "$TAILDECK_ENV" = "production" ]; then
    # Production next steps
    echo "  1. Complete Authentik initial setup:"
    echo "     ${AUTHENTIK_PUBLIC_URL}/if/flow/initial-setup/"
    echo ""
    echo "  2. Build and start TailDeck for production:"
    echo ""
    echo -e "     ${GREEN}npm run build && npm run start${NC}"
    echo ""
    echo "  3. Open ${AUTH_URL}"
    echo "  4. Sign in with Authentik - first user becomes OWNER"
    echo ""
    echo -e "${BOLD}Production Notes:${NC}"
    echo "  - Ensure your reverse proxy (Caddy/nginx) is configured"
    echo "  - SSL certificates should be set up for all domains"
    echo "  - Run 'npm run build' after any .env.local changes"
else
    # Development next steps
    echo "  1. Complete Authentik initial setup (if not done):"
    echo "     http://localhost:9000/if/flow/initial-setup/"
    echo ""
    echo "  2. Update AUTH_AUTHENTIK_SECRET in .env.local (if needed)"
    echo ""
    echo "  3. Start the development server:"
    echo ""
    echo -e "     ${GREEN}npm run dev${NC}"
    echo ""
    echo "  4. Open http://localhost:3000"
    echo "  5. Sign in with Authentik - first user becomes OWNER"
fi
echo ""

echo -e "${BOLD}Useful Commands:${NC}"
echo "  - View logs:      docker compose logs -f"
echo "  - Stop services:  docker compose down"
echo "  - Reset all:      docker compose down -v && ./scripts/setup.sh"
echo ""

log_success "Happy coding!"
