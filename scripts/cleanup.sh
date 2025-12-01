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
if docker compose ps -q 2>/dev/null | grep -q .; then
    docker compose down -v --remove-orphans 2>/dev/null || true
    echo -e "${GREEN}  ✓ Docker containers stopped and removed${NC}"
else
    echo -e "${YELLOW}  - No running containers found${NC}"
fi

# Double-check volumes are removed
echo -e "${BLUE}[3/5]${NC} Removing Docker volumes..."
for vol in taildeck_postgres_data taildeck_authentik_postgres_data taildeck_redis_data taildeck_headscale_data taildeck_authentik_media taildeck_authentik_templates; do
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
rm -f "$PROJECT_DIR/headscale/config.yaml" 2>/dev/null && echo -e "${GREEN}  ✓ Removed headscale/config.yaml${NC}" || true

# Verify clean state
echo -e "${BLUE}[5/5]${NC} Verifying clean state..."
echo ""

containers=$(docker ps -a --filter "name=taildeck" --filter "name=headscale" --filter "name=authentik" -q 2>/dev/null | wc -l)
volumes=$(docker volume ls -q 2>/dev/null | grep -E "^taildeck_" | wc -l)

if [[ "$containers" -eq 0 && "$volumes" -eq 0 ]]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Cleanup Complete!                                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Environment is now ready for a fresh install."
    echo ""
    echo -e "Run ${BLUE}./scripts/setup.sh${NC} to start a new installation."
else
    echo -e "${YELLOW}Warning: Some resources may still exist:${NC}"
    echo "  Containers: $containers"
    echo "  Volumes: $volumes"
fi
