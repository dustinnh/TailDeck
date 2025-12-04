# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Configurable Ports**: All service ports are now configurable via environment variables
  - Setup script asks "Use default ports?" with interactive custom port configuration
  - Detects port conflicts and shows which ports are in use
  - Supports: TailDeck, Authentik HTTP/HTTPS, Headscale API/Metrics, NetFlow/sFlow/IPFIX
  - See SETUP.md for full list of port environment variables
- **Network Topology Visualization**: Interactive graph showing network relationships
  - Headscale server as central hub node
  - Visual distinction between online/offline nodes
  - Subnet routes displayed with connections to advertising nodes
  - Exit node indicators
  - Zoom, pan, and node drag interactions
- **Production Docker Deployment**: Full containerized deployment support
  - Multi-stage Dockerfile optimized for production
  - Docker Compose profile (`--profile app`) for full stack deployment
  - Configurable CSP headers for production URLs
- Toast notifications for all mutation operations (using sonner)
- Loading spinners on action buttons during pending state
- Tag filter dropdown on Machines page
- Search and status filtering on My Devices page
- Clear filters button on Machines, My Devices, and Routes pages
- Helpful admin message on My Devices page directing to Machines page

### Changed

- **Authentik 2025.10**: Upgraded from 2024.2.2 to 2025.10
  - Removed Redis dependency (Authentik 2025.10 uses PostgreSQL for all caching)
  - Database migrations run automatically on first start
- **Headscale 0.27 Compatibility**: Updated API integration for latest Headscale version
  - Node status now uses `status` field instead of deprecated `online` field
  - Graceful fallback for API differences between versions
- DNS page now shows helpful configuration guide when API not available
- Improved error messages with actual error details from Headscale API
- Environment configuration now clearly documents which URLs must be externally accessible

### Fixed

- **Authentik Setup Reliability**: Fixed multiple issues with fresh installations
  - Bootstrap token now written to both `.env` and `.env.local` for Docker Compose compatibility
  - Setup script waits up to 2 minutes for Authentik blueprints to initialize
  - Added `waitForApiReady()` and `waitForScopeMappingsReady()` with proper timeout handling
  - Prevents "Token invalid/expired" errors on first-time setup
- **Authentik 2025.10 API Compatibility**: Updated OAuth2 provider configuration
  - Scope mappings endpoint changed to `/propertymappings/all/` with filtering
  - `redirect_uris` now uses array of `{matching_mode, url}` objects
  - Added required `invalidation_flow` to provider creation
- **Production OAuth Configuration**: AUTH_AUTHENTIK_ISSUER properly configured for production
  - Setup script prompts for Authentik public URL
  - Automatically runs `npm run build` for production deployments
  - Fixes OAuth login issues with incorrect localhost issuer URLs
- **TypeScript Build**: Fixed unused parameter warning in `setup-authentik.ts`
- **Headscale ACL Policy**: Fixed ACL Policy page 502 error by configuring default policy file path
  - Added `headscale/acls.json` with default allow-all policy
  - Updated `config.yaml.template` to set `policy.path: /etc/headscale/acls.json`
  - Mounted ACL file in docker-compose.yml for Headscale container
- API keys page error when `lastSeen` is null (schema validation)
- DNS page error handling for unsupported Headscale versions
- Node online status detection for Headscale 0.27+
- CSP form-action now dynamically uses AUTH_AUTHENTIK_ISSUER for production deployments

## [0.1.0] - 2024-11-30

### Added

- **Device Management**: View, rename, tag, expire, and delete Headscale nodes
- **Bulk Operations**: Select multiple machines for batch delete, expire, move, and tag operations
- **Route Management**: Enable and disable advertised routes per node
- **DNS Configuration**: Manage nameservers, search domains, and MagicDNS settings
- **API Keys Management**: Create, list, and delete Headscale API keys (OWNER role only)
- **ACL Policy Editor**: JSON editor for access control policies
- **Audit Logging**: Track all changes with comprehensive audit trail
- **Role-Based Access Control**: Five-tier role hierarchy (OWNER > ADMIN > OPERATOR > AUDITOR > USER)
- **OIDC Authentication**: Integration with Authentik (or any OIDC provider)
- **Docker Compose Environment**: Full development stack with PostgreSQL, Authentik, Redis, and Headscale
- **Health Check Endpoint**: `/api/health` endpoint for container orchestration
- **Automated Setup Script**: `scripts/setup.sh` for streamlined first-time setup

[Unreleased]: https://github.com/dustinnh/taildeck/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dustinnh/taildeck/releases/tag/v0.1.0
