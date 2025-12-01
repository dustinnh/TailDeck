#!/bin/bash
#
# Validation functions for TailDeck setup
#

# Source colors if not already loaded
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${LIB_DIR}/colors.sh" 2>/dev/null || true

# ============================================
# Input Validators
# ============================================

# Validate URL format
validate_url() {
    local url="$1"
    if [[ "$url" =~ ^https?:// ]]; then
        return 0
    fi
    return 1
}

# Validate domain/hostname format
validate_domain() {
    local domain="$1"
    # Allow localhost, IP addresses, and valid domain names
    if [[ "$domain" =~ ^localhost$ ]] || \
       [[ "$domain" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || \
       [[ "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$ ]]; then
        return 0
    fi
    return 1
}

# Validate email format
validate_email() {
    local email="$1"
    if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    fi
    return 1
}

# Validate password strength
validate_password() {
    local password="$1"
    local min_length="${2:-12}"

    if [ ${#password} -lt $min_length ]; then
        return 1
    fi
    return 0
}

# Validate hex string (for encryption keys)
validate_hex_string() {
    local hex="$1"
    local expected_length="${2:-64}"

    if [[ ${#hex} -eq $expected_length ]] && [[ "$hex" =~ ^[0-9a-fA-F]+$ ]]; then
        return 0
    fi
    return 1
}

# ============================================
# Pre-flight Checks
# ============================================

# Check if a command exists
check_command() {
    local cmd="$1"
    local name="${2:-$cmd}"

    if command -v "$cmd" &> /dev/null; then
        result "success" "${name} is installed"
        return 0
    else
        result "error" "${name} is not installed"
        return 1
    fi
}

# Check if a port is available
check_port() {
    local port="$1"
    local service="${2:-Unknown}"

    if command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":${port} "; then
            result "warning" "Port ${port} (${service}) is in use"
            return 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":${port} "; then
            result "warning" "Port ${port} (${service}) is in use"
            return 1
        fi
    elif command -v lsof &> /dev/null; then
        if lsof -i ":${port}" &> /dev/null; then
            result "warning" "Port ${port} (${service}) is in use"
            return 1
        fi
    else
        result "info" "Cannot check port ${port} (no ss/netstat/lsof)"
        return 0
    fi

    result "success" "Port ${port} (${service}) is available"
    return 0
}

# Check Docker daemon
check_docker() {
    if ! command -v docker &> /dev/null; then
        result "error" "Docker is not installed"
        return 1
    fi

    if ! docker info &> /dev/null; then
        result "error" "Docker daemon is not running"
        return 1
    fi

    result "success" "Docker is running"
    return 0
}

# Check Docker Compose
check_docker_compose() {
    if docker compose version &> /dev/null; then
        result "success" "Docker Compose (plugin) is available"
        return 0
    elif command -v docker-compose &> /dev/null; then
        result "success" "Docker Compose (standalone) is available"
        return 0
    fi

    result "error" "Docker Compose is not available"
    return 1
}

# Check network connectivity
check_network() {
    local test_url="${1:-https://registry-1.docker.io/v2/}"
    local name="${2:-Docker Hub}"

    if curl -s --connect-timeout 5 "$test_url" > /dev/null 2>&1; then
        result "success" "${name} is reachable"
        return 0
    else
        result "warning" "${name} is not reachable"
        return 1
    fi
}

# Check DNS resolution for domain
check_dns() {
    local domain="$1"

    # Skip for localhost
    if [ "$domain" = "localhost" ]; then
        result "success" "DNS: localhost (no resolution needed)"
        return 0
    fi

    if command -v nslookup &> /dev/null; then
        if nslookup "$domain" > /dev/null 2>&1; then
            result "success" "DNS: ${domain} resolves"
            return 0
        fi
    elif command -v dig &> /dev/null; then
        if dig +short "$domain" | grep -q .; then
            result "success" "DNS: ${domain} resolves"
            return 0
        fi
    elif command -v host &> /dev/null; then
        if host "$domain" > /dev/null 2>&1; then
            result "success" "DNS: ${domain} resolves"
            return 0
        fi
    fi

    result "warning" "DNS: ${domain} does not resolve (may be internal)"
    return 1
}

# Run all pre-flight checks
preflight_checks() {
    header "Pre-flight Checks"

    local errors=0
    local warnings=0

    subheader "Required Commands"
    check_command "docker" || ((errors++))
    check_docker_compose || ((errors++))
    check_command "node" "Node.js" || ((errors++))
    check_command "npm" || ((errors++))
    check_command "curl" || ((errors++))
    check_command "openssl" || ((warnings++))
    check_command "jq" || ((warnings++))

    subheader "Docker Status"
    check_docker || ((errors++))

    subheader "Required Ports"
    check_port 3000 "TailDeck" || ((warnings++))
    check_port 5432 "PostgreSQL" || ((warnings++))
    check_port 8080 "Headscale" || ((warnings++))
    check_port 9000 "Authentik" || ((warnings++))

    subheader "Network Connectivity"
    check_network "https://registry-1.docker.io/v2/" "Docker Hub" || ((warnings++))
    check_network "https://ghcr.io/v2/" "GitHub Container Registry" || ((warnings++))

    # Check Node.js version
    subheader "Runtime Versions"
    local node_version
    node_version=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
    if [ -n "$node_version" ] && [ "$node_version" -ge 18 ]; then
        result "success" "Node.js version: $(node -v)"
    else
        result "error" "Node.js 18+ required (found: $(node -v 2>/dev/null || echo 'none'))"
        ((errors++))
    fi

    echo ""
    if [ $errors -gt 0 ]; then
        log_error "Pre-flight checks failed with ${errors} error(s)"
        return 1
    elif [ $warnings -gt 0 ]; then
        log_warn "Pre-flight checks passed with ${warnings} warning(s)"
        return 0
    else
        log_success "All pre-flight checks passed"
        return 0
    fi
}

# ============================================
# Security Checks
# ============================================

# Check for weak/default passwords
check_weak_password() {
    local password="$1"
    local name="${2:-password}"

    local weak_passwords=(
        "password" "password123" "admin" "admin123" "123456" "12345678"
        "changeme" "default" "secret" "taildeck" "headscale" "authentik"
    )

    for weak in "${weak_passwords[@]}"; do
        if [ "$password" = "$weak" ]; then
            result "error" "${name} is a weak/common password"
            return 1
        fi
    done

    if [ ${#password} -lt 12 ]; then
        result "warning" "${name} is shorter than 12 characters"
        return 1
    fi

    result "success" "${name} passes basic strength check"
    return 0
}

# Check AUTH_SECRET strength
check_auth_secret() {
    local secret="$1"

    if [ ${#secret} -lt 32 ]; then
        result "error" "AUTH_SECRET is too short (need 32+ chars, have ${#secret})"
        return 1
    fi

    result "success" "AUTH_SECRET length is adequate (${#secret} chars)"
    return 0
}

# Check ENCRYPTION_KEY format
check_encryption_key() {
    local key="$1"

    if [ ${#key} -ne 64 ]; then
        result "error" "ENCRYPTION_KEY must be 64 hex characters (have ${#key})"
        return 1
    fi

    if ! [[ "$key" =~ ^[0-9a-fA-F]+$ ]]; then
        result "error" "ENCRYPTION_KEY must be hexadecimal"
        return 1
    fi

    result "success" "ENCRYPTION_KEY format is valid"
    return 0
}

# Check for HTTP in production
check_https() {
    local url="$1"
    local env="${2:-production}"

    if [ "$env" = "production" ] && [[ "$url" =~ ^http:// ]]; then
        result "error" "Using HTTP in production is insecure"
        return 1
    fi

    if [[ "$url" =~ ^https:// ]]; then
        result "success" "Using HTTPS"
    else
        result "warning" "Not using HTTPS (acceptable for development)"
    fi
    return 0
}

# Run all security checks
security_checks() {
    local auth_url="${1:-}"
    local auth_secret="${2:-}"
    local environment="${3:-development}"

    header "Security Checks"

    local critical=0
    local warnings=0

    # Check HTTPS
    if [ -n "$auth_url" ]; then
        check_https "$auth_url" "$environment" || {
            if [ "$environment" = "production" ]; then
                ((critical++))
            else
                ((warnings++))
            fi
        }
    fi

    # Check AUTH_SECRET
    if [ -n "$auth_secret" ]; then
        check_auth_secret "$auth_secret" || ((critical++))
    fi

    echo ""
    if [ $critical -gt 0 ]; then
        log_error "${critical} critical security issue(s) found"

        if [ "$environment" = "production" ]; then
            box "CRITICAL: Do not deploy with these security issues!" "$RED"
            return 1
        fi
    fi

    if [ $warnings -gt 0 ]; then
        log_warn "${warnings} security warning(s)"
    else
        log_success "Security checks passed"
    fi

    return 0
}
