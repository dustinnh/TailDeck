#!/usr/bin/env bash
#
# TailDeck Cleanup Script
# Removes all Docker containers, volumes, networks, and resets to fresh install state
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              TailDeck Cleanup Script                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Caddy is running
CADDY_RUNNING=false
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "taildeck-caddy"; then
    CADDY_RUNNING=true
fi

# Confirmation
echo -e "${YELLOW}WARNING: This will remove:${NC}"
echo "  - All TailDeck Docker containers"
echo "  - All TailDeck Docker volumes (DATABASE DATA WILL BE LOST)"
echo "  - All TailDeck Docker networks"
echo "  - .env and .env.local files"
echo "  - .next build directory"
echo "  - headscale/config.yaml"
echo ""

read -p "Are you sure you want to continue? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Cleanup cancelled.${NC}"
    exit 0
fi

# Ask about Caddy if it's running
KEEP_CADDY=false
if [[ "$CADDY_RUNNING" == "true" ]]; then
    echo ""
    read -p "Caddy reverse proxy is running. Keep it? (y/N): " keep_caddy
    if [[ "$keep_caddy" =~ ^[Yy]$ ]]; then
        KEEP_CADDY=true
        echo -e "${BLUE}  ℹ Caddy will be preserved${NC}"
    fi
fi

echo ""

# Kill any running Node processes
echo -e "${BLUE}[1/5]${NC} Stopping Node processes..."
pkill -f "next" 2>/dev/null || true
pkill -f "node.*taildeck" 2>/dev/null || true
sleep 1
echo -e "${GREEN}  ✓ Node processes stopped${NC}"

# Stop and remove Docker containers, volumes, networks
echo -e "${BLUE}[2/5]${NC} Stopping Docker containers..."
cd "$PROJECT_DIR"

# Use --profile app to catch all containers including taildeck-taildeck and caddy
if docker compose --profile app ps -q 2>/dev/null | grep -q .; then
    if [[ "$KEEP_CADDY" == "true" ]]; then
        # Stop everything except Caddy - first stop without -v, then selectively remove
        docker compose --profile app stop 2>/dev/null || true
        # Start Caddy back up
        docker compose up -d taildeck-caddy 2>/dev/null || true
        # Remove non-Caddy containers and volumes
        docker compose down -v --remove-orphans 2>/dev/null || true
        echo -e "${GREEN}  ✓ Docker containers stopped (Caddy preserved)${NC}"
    else
        docker compose --profile app down -v --remove-orphans 2>/dev/null || true
        echo -e "${GREEN}  ✓ Docker containers stopped and removed${NC}"
    fi
else
    # Fallback: manually stop containers that might have been started outside compose
    echo -e "${YELLOW}  - No compose containers found, checking for orphans...${NC}"
    for container in taildeck-taildeck taildeck-caddy headscale authentik-server authentik-worker authentik-postgres taildeck-postgres taildeck-goflow; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            if [[ "$container" == "taildeck-caddy" && "$KEEP_CADDY" == "true" ]]; then
                echo -e "${BLUE}  ℹ Keeping: $container${NC}"
            else
                docker rm -f "$container" 2>/dev/null || true
                echo -e "${GREEN}  ✓ Removed: $container${NC}"
            fi
        fi
    done
fi

# Double-check volumes are removed
# Docker Compose lowercases the project name for volume naming
# e.g., "TailDeck" folder -> "taildeck_postgres_data" volume
PROJECT_NAME=$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')
echo -e "${BLUE}[3/5]${NC} Removing Docker volumes..."
for vol_suffix in postgres_data authentik_postgres_data headscale_data authentik_media authentik_templates goflow_data; do
    vol="${PROJECT_NAME}_${vol_suffix}"
    if docker volume ls -q | grep -q "^${vol}$"; then
        docker volume rm "$vol" 2>/dev/null || true
        echo -e "${GREEN}  ✓ Removed volume: $vol${NC}"
    fi
done
echo -e "${GREEN}  ✓ Docker volumes cleaned${NC}"

# Remove project files
echo -e "${BLUE}[4/5]${NC} Removing configuration files..."
rm -f "$PROJECT_DIR/.env" 2>/dev/null && echo -e "${GREEN}  ✓ Removed .env${NC}" || true
rm -f "$PROJECT_DIR/.env.local" 2>/dev/null && echo -e "${GREEN}  ✓ Removed .env.local${NC}" || true
rm -rf "$PROJECT_DIR/.next" 2>/dev/null && echo -e "${GREEN}  ✓ Removed .next/${NC}" || true
# Use -rf in case config.yaml was accidentally created as a directory
rm -rf "$PROJECT_DIR/headscale/config.yaml" 2>/dev/null && echo -e "${GREEN}  ✓ Removed headscale/config.yaml${NC}" || true

# Verify clean state
echo -e "${BLUE}[5/5]${NC} Verifying clean state..."
echo ""

# Count remaining containers (exclude Caddy if we're keeping it)
if [[ "$KEEP_CADDY" == "true" ]]; then
    containers=$(docker ps -a --filter "name=taildeck" --filter "name=headscale" --filter "name=authentik" --format '{{.Names}}' 2>/dev/null | grep -v "taildeck-caddy" | wc -l)
else
    containers=$(docker ps -a --filter "name=taildeck" --filter "name=headscale" --filter "name=authentik" -q 2>/dev/null | wc -l)
fi
# Check for volumes with lowercase project name (Docker Compose lowercases it)
volumes=$(docker volume ls -q 2>/dev/null | grep -iE "^${PROJECT_NAME}_" | wc -l)

if [[ "$containers" -eq 0 && "$volumes" -eq 0 ]]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Cleanup Complete!                                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    if [[ "$KEEP_CADDY" == "true" ]]; then
        echo "Environment is now ready for a fresh install (Caddy preserved)."
    else
        echo "Environment is now ready for a fresh install."
    fi
    echo ""
    echo -e "Run ${BLUE}./scripts/setup.sh${NC} to start a new installation."
else
    echo -e "${YELLOW}Warning: Some resources may still exist:${NC}"
    echo "  Containers: $containers"
    echo "  Volumes: $volumes"
    echo ""
    echo "You can manually remove them with:"
    echo "  docker ps -a --filter 'name=taildeck' --filter 'name=headscale' --filter 'name=authentik' -q | xargs -r docker rm -f"
    echo "  docker volume ls -q | grep -i '${PROJECT_NAME}_' | xargs -r docker volume rm"
fi
