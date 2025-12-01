#!/bin/bash
#
# Authentik API automation for TailDeck setup
#

# Source colors if not already loaded
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${LIB_DIR}/colors.sh" 2>/dev/null || true

# Default Authentik configuration
AUTHENTIK_URL="${AUTHENTIK_URL:-http://localhost:9000}"
AUTHENTIK_TOKEN="${AUTHENTIK_BOOTSTRAP_TOKEN:-}"

# Make API request to Authentik
authentik_api() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"

    local url="${AUTHENTIK_URL}/api/v3${endpoint}"
    local curl_args=(-s -X "$method" -H "Authorization: Bearer ${AUTHENTIK_TOKEN}" -H "Content-Type: application/json")

    if [ -n "$data" ]; then
        curl_args+=(-d "$data")
    fi

    curl "${curl_args[@]}" "$url" 2>/dev/null
}

# Wait for Authentik API to be ready
wait_for_authentik_api() {
    local max_attempts="${1:-60}"
    local attempt=1

    log_info "Waiting for Authentik API to be ready..."

    while [ $attempt -le $max_attempts ]; do
        local response
        response=$(curl -s -o /dev/null -w "%{http_code}" "${AUTHENTIK_URL}/api/v3/root/config/" 2>/dev/null)

        if [ "$response" = "200" ] || [ "$response" = "403" ]; then
            log_success "Authentik API is ready"
            return 0
        fi

        printf "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo ""
    log_error "Authentik API did not become ready"
    return 1
}

# Get the default authorization flow UUID
get_authorization_flow() {
    local response
    response=$(authentik_api GET "/flows/instances/?designation=authorization")

    echo "$response" | jq -r '.results[] | select(.slug == "default-provider-authorization-implicit-consent") | .pk' 2>/dev/null | head -1
}

# Get scope mapping UUIDs
get_scope_mappings() {
    local response
    response=$(authentik_api GET "/propertymappings/scope/")

    # Return JSON array of UUIDs for openid, profile, email, groups
    local mappings
    mappings=$(echo "$response" | jq -r '[.results[] | select(.scope_name | test("openid|profile|email|groups$")) | .pk]' 2>/dev/null)

    echo "$mappings"
}

# Check if OAuth2 provider exists
oauth2_provider_exists() {
    local name="${1:-TailDeck OAuth2}"
    local response
    response=$(authentik_api GET "/providers/oauth2/")

    echo "$response" | jq -e ".results[] | select(.name == \"$name\")" > /dev/null 2>&1
}

# Create OAuth2 provider
create_oauth2_provider() {
    local name="${1:-TailDeck OAuth2}"
    local client_id="${2:-taildeck}"
    local redirect_uri="${3:-http://localhost:3000/api/auth/callback/authentik}"
    local flow_uuid="$4"
    local scope_mappings="$5"

    log_info "Creating OAuth2 provider: ${name}"

    # Generate client secret
    local client_secret
    client_secret=$(openssl rand -hex 32)

    local payload
    payload=$(cat <<EOF
{
    "name": "${name}",
    "authorization_flow": "${flow_uuid}",
    "client_type": "confidential",
    "client_id": "${client_id}",
    "client_secret": "${client_secret}",
    "access_token_validity": "minutes=10",
    "refresh_token_validity": "days=30",
    "include_claims_in_id_token": true,
    "property_mappings": ${scope_mappings},
    "redirect_uris": [{"matching_mode": "strict", "url": "${redirect_uri}"}]
}
EOF
)

    local response
    response=$(authentik_api POST "/providers/oauth2/" "$payload")

    local pk
    pk=$(echo "$response" | jq -r '.pk' 2>/dev/null)

    if [ -n "$pk" ] && [ "$pk" != "null" ]; then
        log_success "Created OAuth2 provider (pk: ${pk})"
        echo "$client_secret"
        return 0
    else
        local error
        error=$(echo "$response" | jq -r '.detail // .non_field_errors[0] // "Unknown error"' 2>/dev/null)
        log_error "Failed to create OAuth2 provider: ${error}"
        return 1
    fi
}

# Get OAuth2 provider ID by name
get_oauth2_provider_id() {
    local name="${1:-TailDeck OAuth2}"
    local response
    response=$(authentik_api GET "/providers/oauth2/")

    echo "$response" | jq -r ".results[] | select(.name == \"$name\") | .pk" 2>/dev/null | head -1
}

# Check if application exists
application_exists() {
    local slug="${1:-taildeck}"
    local response
    response=$(authentik_api GET "/core/applications/")

    echo "$response" | jq -e ".results[] | select(.slug == \"$slug\")" > /dev/null 2>&1
}

# Create application
create_application() {
    local name="${1:-TailDeck}"
    local slug="${2:-taildeck}"
    local provider_id="$3"

    log_info "Creating application: ${name}"

    local payload
    payload=$(cat <<EOF
{
    "name": "${name}",
    "slug": "${slug}",
    "provider": ${provider_id},
    "policy_engine_mode": "any"
}
EOF
)

    local response
    response=$(authentik_api POST "/core/applications/" "$payload")

    local pk
    pk=$(echo "$response" | jq -r '.pk' 2>/dev/null)

    if [ -n "$pk" ] && [ "$pk" != "null" ]; then
        log_success "Created application: ${name}"
        return 0
    else
        local error
        error=$(echo "$response" | jq -r '.detail // .non_field_errors[0] // "Unknown error"' 2>/dev/null)
        log_error "Failed to create application: ${error}"
        return 1
    fi
}

# Check if group exists
group_exists() {
    local name="$1"
    local response
    response=$(authentik_api GET "/core/groups/")

    echo "$response" | jq -e ".results[] | select(.name == \"$name\")" > /dev/null 2>&1
}

# Create group
create_group() {
    local name="$1"

    log_info "Creating group: ${name}"

    local payload
    payload=$(cat <<EOF
{
    "name": "${name}",
    "is_superuser": false
}
EOF
)

    local response
    response=$(authentik_api POST "/core/groups/" "$payload")

    local pk
    pk=$(echo "$response" | jq -r '.pk' 2>/dev/null)

    if [ -n "$pk" ] && [ "$pk" != "null" ]; then
        log_success "Created group: ${name}"
        return 0
    else
        local error
        error=$(echo "$response" | jq -r '.detail // .non_field_errors[0] // "Unknown error"' 2>/dev/null)

        # Check if it's a duplicate error
        if echo "$error" | grep -qi "already exists"; then
            log_info "Group ${name} already exists"
            return 0
        fi

        log_error "Failed to create group: ${error}"
        return 1
    fi
}

# Create all RBAC groups
create_rbac_groups() {
    log_info "Creating RBAC groups..."

    local groups=("TailDeck Admins" "TailDeck Operators" "TailDeck Auditors" "TailDeck Users")
    local errors=0

    for group in "${groups[@]}"; do
        if ! group_exists "$group"; then
            create_group "$group" || ((errors++))
        else
            log_info "Group ${group} already exists"
        fi
    done

    if [ $errors -gt 0 ]; then
        log_warn "Some groups failed to create"
        return 1
    fi

    log_success "All RBAC groups created"
    return 0
}

# Full Authentik setup
setup_authentik() {
    local auth_url="${1:-http://localhost:3000}"
    local client_id="${2:-taildeck}"

    header "Authentik Configuration"

    # Check if token is set
    if [ -z "$AUTHENTIK_TOKEN" ]; then
        log_error "AUTHENTIK_BOOTSTRAP_TOKEN is not set"
        echo ""
        echo -e "${YELLOW}To configure Authentik automatically, you need a bootstrap token.${NC}"
        echo -e "Add this to your docker-compose.yml authentik-server environment:"
        echo ""
        echo -e "  ${CYAN}AUTHENTIK_BOOTSTRAP_TOKEN: \"your-token-here\"${NC}"
        echo ""
        return 1
    fi

    # Wait for API
    wait_for_authentik_api 90 || return 1

    # Get authorization flow
    log_info "Getting authorization flow..."
    local flow_uuid
    flow_uuid=$(get_authorization_flow)

    if [ -z "$flow_uuid" ] || [ "$flow_uuid" = "null" ]; then
        log_error "Could not find authorization flow"
        return 1
    fi
    log_success "Found authorization flow: ${flow_uuid}"

    # Get scope mappings
    log_info "Getting scope mappings..."
    local scope_mappings
    scope_mappings=$(get_scope_mappings)

    if [ -z "$scope_mappings" ] || [ "$scope_mappings" = "[]" ]; then
        log_error "Could not find scope mappings"
        return 1
    fi
    log_success "Found scope mappings"

    # Check/create OAuth2 provider
    local client_secret=""
    if oauth2_provider_exists "TailDeck OAuth2"; then
        log_info "OAuth2 provider already exists"
    else
        local redirect_uri="${auth_url}/api/auth/callback/authentik"
        client_secret=$(create_oauth2_provider "TailDeck OAuth2" "$client_id" "$redirect_uri" "$flow_uuid" "$scope_mappings")

        if [ $? -ne 0 ]; then
            return 1
        fi
    fi

    # Get provider ID
    local provider_id
    provider_id=$(get_oauth2_provider_id "TailDeck OAuth2")

    if [ -z "$provider_id" ]; then
        log_error "Could not get provider ID"
        return 1
    fi

    # Check/create application
    if application_exists "taildeck"; then
        log_info "Application already exists"
    else
        create_application "TailDeck" "taildeck" "$provider_id" || return 1
    fi

    # Create RBAC groups
    create_rbac_groups

    echo ""
    log_success "Authentik configuration complete!"

    if [ -n "$client_secret" ]; then
        echo ""
        box "Save this client secret - it won't be shown again!" "$YELLOW"
        echo ""
        echo -e "${CYAN}AUTH_AUTHENTIK_SECRET=${NC}${client_secret}"
        echo ""

        # Optionally update .env.local
        if [ -f ".env.local" ] && grep -q "your-authentik-client-secret" ".env.local"; then
            if prompt_confirm "Update .env.local with this secret?" "y" 2>/dev/null; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s|your-authentik-client-secret|${client_secret}|" .env.local
                else
                    sed -i "s|your-authentik-client-secret|${client_secret}|" .env.local
                fi
                log_success "Updated .env.local"
            fi
        fi
    fi

    return 0
}
