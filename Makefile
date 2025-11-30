# TailDeck Makefile
# Convenience commands for development and deployment

.PHONY: help setup dev start stop logs clean reset build test lint typecheck db-push db-seed

# Default target
help:
	@echo "TailDeck Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup     - Run full setup (first time)"
	@echo "  make install   - Install npm dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev       - Start dev server (infrastructure + Next.js)"
	@echo "  make start     - Start infrastructure only"
	@echo "  make stop      - Stop all services"
	@echo "  make logs      - View service logs"
	@echo "  make restart   - Restart infrastructure"
	@echo ""
	@echo "Database:"
	@echo "  make db-push   - Push schema to database"
	@echo "  make db-seed   - Seed database with roles"
	@echo "  make db-reset  - Reset database (WARNING: deletes data)"
	@echo ""
	@echo "Quality:"
	@echo "  make lint      - Run ESLint"
	@echo "  make typecheck - Run TypeScript checks"
	@echo "  make test      - Run all checks"
	@echo ""
	@echo "Production:"
	@echo "  make build     - Build for production"
	@echo "  make docker    - Build and run in Docker"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean     - Remove build artifacts"
	@echo "  make reset     - Full reset (WARNING: deletes all data)"

# ===========================================
# Setup
# ===========================================

setup:
	./scripts/setup.sh

install:
	npm install

# ===========================================
# Development
# ===========================================

dev: start
	@echo "Starting Next.js development server..."
	npm run dev

start:
	@echo "Starting Docker infrastructure..."
	docker compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	docker compose ps

stop:
	@echo "Stopping all services..."
	docker compose down

restart: stop start

logs:
	docker compose logs -f

# ===========================================
# Database
# ===========================================

db-generate:
	npm run db:generate

db-push: db-generate
	npm run db:push

db-seed:
	npm run db:seed

db-reset:
	@echo "WARNING: This will delete all database data!"
	@read -p "Are you sure? (y/N) " confirm && [ "$$confirm" = "y" ]
	docker compose down -v
	docker compose up -d postgres
	@sleep 5
	npm run db:push
	npm run db:seed

# ===========================================
# Quality
# ===========================================

lint:
	npm run lint

lint-fix:
	npm run lint:fix

typecheck:
	npm run typecheck

test: lint typecheck
	@echo "All checks passed!"

# ===========================================
# Production
# ===========================================

build:
	npm run build

docker:
	docker compose --profile app up -d --build

docker-logs:
	docker compose --profile app logs -f

# ===========================================
# Cleanup
# ===========================================

clean:
	rm -rf .next
	rm -rf node_modules/.cache

reset:
	@echo "WARNING: This will delete ALL data and reset the environment!"
	@read -p "Are you sure? (y/N) " confirm && [ "$$confirm" = "y" ]
	docker compose down -v
	rm -rf node_modules .next
	rm -f .env.local
	@echo "Reset complete. Run 'make setup' to start fresh."

# ===========================================
# Utilities
# ===========================================

headscale-key:
	@docker exec headscale headscale apikeys create --expiration 365d

headscale-users:
	@docker exec headscale headscale users list

headscale-nodes:
	@docker exec headscale headscale nodes list
