#!/bin/bash
#
# Docker helper functions for TailDeck setup
#

# Source colors if not already loaded
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${LIB_DIR}/colors.sh" 2>/dev/null || true

# Get the docker compose command (handles both plugin and standalone)
get_docker_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    elif command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        log_error "Docker Compose is not available"
        exit 1
    fi
}

# Start Docker services
docker_up() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    log_info "Starting Docker services..."

    # Use --env-file to load .env.local if it exists
    if [ -f ".env.local" ]; then
        $compose_cmd --env-file .env.local up -d
    else
        $compose_cmd up -d
    fi

    if [ $? -eq 0 ]; then
        log_success "Docker services started"
        return 0
    else
        log_error "Failed to start Docker services"
        return 1
    fi
}

# Stop Docker services
docker_down() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    log_info "Stopping Docker services..."
    $compose_cmd down
}

# Stop Docker services and remove volumes
docker_down_volumes() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    log_info "Stopping Docker services and removing volumes..."
    $compose_cmd down -v
}

# Check if a service is healthy
docker_service_healthy() {
    local service="$1"
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    $compose_cmd ps "$service" 2>/dev/null | grep -q "healthy"
}

# Wait for a service to become healthy
wait_for_service() {
    local service="$1"
    local max_attempts="${2:-60}"
    local interval="${3:-2}"
    local attempt=1
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    log_info "Waiting for ${service} to be healthy..."

    while [ $attempt -le $max_attempts ]; do
        if $compose_cmd ps "$service" 2>/dev/null | grep -q "healthy"; then
            log_success "${service} is healthy"
            return 0
        fi

        printf "."
        sleep $interval
        attempt=$((attempt + 1))
    done

    echo ""
    log_error "${service} did not become healthy in time"
    return 1
}

# Wait for HTTP endpoint to respond
wait_for_http() {
    local url="$1"
    local max_attempts="${2:-60}"
    local interval="${3:-2}"
    local expected_codes="${4:-200 301 302}"
    local attempt=1

    log_info "Waiting for ${url} to be available..."

    while [ $attempt -le $max_attempts ]; do
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null)

        for code in $expected_codes; do
            if [ "$status_code" = "$code" ]; then
                log_success "${url} is available (HTTP ${status_code})"
                return 0
            fi
        done

        printf "."
        sleep $interval
        attempt=$((attempt + 1))
    done

    echo ""
    log_warn "${url} not responding (may still be initializing)"
    return 1
}

# Execute command in a container
docker_exec() {
    local container="$1"
    shift
    local cmd="$@"

    docker exec "$container" $cmd
}

# Get container logs
docker_logs() {
    local container="$1"
    local lines="${2:-50}"

    docker logs --tail "$lines" "$container" 2>&1
}

# Check if container exists and is running
container_running() {
    local container="$1"

    docker ps --filter "name=${container}" --filter "status=running" | grep -q "$container"
}

# Get container IP address
container_ip() {
    local container="$1"

    docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container" 2>/dev/null
}

# Wait for all core services
wait_for_all_services() {
    subheader "Waiting for Services"

    local errors=0

    wait_for_service "postgres" 60 || ((errors++))
    wait_for_service "authentik-postgres" 60 || ((errors++))

    # Authentik takes longer to initialize
    log_info "Waiting for Authentik to initialize (this may take 1-2 minutes)..."
    sleep 10
    wait_for_http "http://localhost:9000" 90 || ((errors++))

    # Wait for Headscale
    wait_for_service "headscale" 30 || ((errors++))
    wait_for_http "http://localhost:8080/health" 30 || true  # Headscale health endpoint

    if [ $errors -gt 0 ]; then
        log_error "${errors} service(s) failed to start"
        return 1
    fi

    log_success "All services are running"
    return 0
}

# Pull latest images
docker_pull() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    log_info "Pulling latest Docker images..."
    $compose_cmd pull

    if [ $? -eq 0 ]; then
        log_success "Images updated"
    else
        log_warn "Some images may not have been updated"
    fi
}

# Show running services status
docker_status() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    echo ""
    echo -e "${BOLD}Service Status:${NC}"
    echo ""
    $compose_cmd ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
}

# Get service port mapping
get_service_port() {
    local service="$1"
    local internal_port="$2"
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    $compose_cmd port "$service" "$internal_port" 2>/dev/null | cut -d: -f2
}
