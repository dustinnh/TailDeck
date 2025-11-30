# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Toast notifications for all mutation operations (using sonner)
- Loading spinners on action buttons during pending state
- Tag filter dropdown on Machines page
- Search and status filtering on My Devices page
- Clear filters button on Machines, My Devices, and Routes pages
- Helpful admin message on My Devices page directing to Machines page

### Changed

- DNS page now shows helpful configuration guide when API not available
- Improved error messages with actual error details from Headscale API

### Fixed

- API keys page error when `lastSeen` is null (schema validation)
- DNS page error handling for unsupported Headscale versions

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

[Unreleased]: https://github.com/yourusername/taildeck/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/taildeck/releases/tag/v0.1.0
