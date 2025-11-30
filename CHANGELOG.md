# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
