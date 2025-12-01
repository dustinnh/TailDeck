#!/bin/bash
#
# Headscale configuration helpers for TailDeck setup
#

# Source colors if not already loaded
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${LIB_DIR}/colors.sh" 2>/dev/null || true

# Generate Headscale config from template
generate_headscale_config() {
    local template_file="${1:-headscale/config.yaml.template}"
    local output_file="${2:-headscale/config.yaml}"

    local headscale_url="${HEADSCALE_URL:-http://localhost:8080}"
    local magic_dns_enabled="${MAGIC_DNS_ENABLED:-true}"
    local magic_dns_domain="${MAGIC_DNS_DOMAIN:-taildeck.local}"
    local log_level="${LOG_LEVEL:-info}"
    local environment="${TAILDECK_ENV:-development}"

    log_info "Generating Headscale configuration..."

    if [ ! -f "$template_file" ]; then
        log_error "Template file not found: ${template_file}"
        return 1
    fi

    # Process template
    sed -e "s|{{HEADSCALE_PUBLIC_URL}}|${headscale_url}|g" \
        -e "s|{{MAGIC_DNS_ENABLED}}|${magic_dns_enabled}|g" \
        -e "s|{{MAGIC_DNS_DOMAIN}}|${magic_dns_domain}|g" \
        -e "s|{{LOG_LEVEL}}|${log_level}|g" \
        "$template_file" > "$output_file"

    if [ $? -eq 0 ]; then
        log_success "Generated ${output_file}"
        return 0
    else
        log_error "Failed to generate Headscale config"
        return 1
    fi
}

# Generate or retrieve Headscale API key
# Note: This function outputs ONLY the API key to stdout.
# All log messages go to stderr to avoid capturing them in $()
generate_headscale_api_key() {
    local container="${1:-headscale}"
    local expiration="${2:-365d}"

    # Log to stderr to avoid capturing in command substitution
    echo -e "${BLUE}[INFO]${NC} Generating Headscale API key..." >&2

    # Wait for Headscale to be ready
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if docker exec "$container" headscale version &> /dev/null; then
            break
        fi
        sleep 2
        attempts=$((attempts + 1))
    done

    if [ $attempts -ge 30 ]; then
        echo -e "${RED}[ERROR]${NC} Headscale container not ready" >&2
        return 1
    fi

    # Generate API key
    local api_key
    api_key=$(docker exec "$container" headscale apikeys create --expiration "$expiration" 2>/dev/null)

    # Strip any whitespace/newlines
    api_key=$(echo "$api_key" | tr -d '[:space:]')

    if [ -n "$api_key" ]; then
        # Only output the clean API key to stdout
        echo "$api_key"
        return 0
    else
        echo -e "${RED}[ERROR]${NC} Failed to generate Headscale API key" >&2
        return 1
    fi
}

# List existing API keys
list_headscale_api_keys() {
    local container="${1:-headscale}"

    docker exec "$container" headscale apikeys list 2>/dev/null
}

# Expire an API key
expire_headscale_api_key() {
    local container="${1:-headscale}"
    local key_prefix="$2"

    docker exec "$container" headscale apikeys expire --prefix "$key_prefix" 2>/dev/null
}

# Create Headscale user (namespace)
create_headscale_user() {
    local container="${1:-headscale}"
    local username="$2"

    log_info "Creating Headscale user: ${username}"

    docker exec "$container" headscale users create "$username" 2>/dev/null

    if [ $? -eq 0 ]; then
        log_success "Created user: ${username}"
        return 0
    else
        # Check if user already exists
        if docker exec "$container" headscale users list 2>/dev/null | grep -q "^$username"; then
            log_info "User ${username} already exists"
            return 0
        fi
        log_error "Failed to create user: ${username}"
        return 1
    fi
}

# List Headscale users
list_headscale_users() {
    local container="${1:-headscale}"

    docker exec "$container" headscale users list 2>/dev/null
}

# Get Headscale version
get_headscale_version() {
    local container="${1:-headscale}"

    docker exec "$container" headscale version 2>/dev/null | head -1
}

# Check Headscale health
check_headscale_health() {
    local container="${1:-headscale}"

    if docker exec "$container" headscale health 2>/dev/null; then
        result "success" "Headscale is healthy"
        return 0
    else
        result "error" "Headscale health check failed"
        return 1
    fi
}

# Update .env.local with Headscale API key
update_env_headscale_key() {
    local env_file="${1:-.env.local}"
    local api_key="$2"

    if [ -z "$api_key" ]; then
        log_error "API key is required"
        return 1
    fi

    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: ${env_file}"
        return 1
    fi

    # Strip any whitespace/newlines from the API key
    api_key=$(echo "$api_key" | tr -d '[:space:]')

    # Check if placeholder exists
    if grep -q "your-headscale-api-key" "$env_file"; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|your-headscale-api-key|${api_key}|" "$env_file"
        else
            sed -i "s|your-headscale-api-key|${api_key}|" "$env_file"
        fi
        log_success "Updated Headscale API key in ${env_file}"
        return 0
    else
        log_info "Headscale API key already configured"
        return 0
    fi
}

# Display Headscale info
show_headscale_info() {
    local container="${1:-headscale}"

    echo ""
    echo -e "${BOLD}Headscale Information:${NC}"
    echo -e "${DIM}──────────────────────────────────────${NC}"
    echo -e "  ${CYAN}Container:${NC} ${container}"
    echo -e "  ${CYAN}Version:${NC} $(get_headscale_version "$container")"
    echo -e "  ${CYAN}API URL:${NC} http://localhost:8080"
    echo -e "  ${CYAN}Metrics:${NC} http://localhost:9090"
    echo -e "${DIM}──────────────────────────────────────${NC}"
    echo ""
}
