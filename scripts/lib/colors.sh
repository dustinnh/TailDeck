#!/bin/bash
#
# Color and formatting helpers for TailDeck setup scripts
#

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export MAGENTA='\033[0;35m'
export CYAN='\033[0;36m'
export WHITE='\033[1;37m'
export GRAY='\033[0;90m'
export NC='\033[0m' # No Color

# Bold variants
export BOLD='\033[1m'
export DIM='\033[2m'
export UNDERLINE='\033[4m'

# Status icons
export CHECK_MARK="${GREEN}✓${NC}"
export CROSS_MARK="${RED}✗${NC}"
export WARNING_MARK="${YELLOW}!${NC}"
export INFO_MARK="${BLUE}ℹ${NC}"
export ARROW="${CYAN}→${NC}"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    if [ "${DEBUG:-0}" = "1" ]; then
        echo -e "${GRAY}[DEBUG]${NC} $1"
    fi
}

# Header display
header() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN} $1${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
}

# Sub-header display
subheader() {
    echo ""
    echo -e "${CYAN}--- $1 ---${NC}"
    echo ""
}

# Status line with icon
status() {
    local icon="$1"
    local message="$2"
    echo -e "  ${icon} ${message}"
}

# Progress indicator
progress() {
    local current="$1"
    local total="$2"
    local message="$3"
    local percent=$((current * 100 / total))
    echo -e "${CYAN}[${current}/${total}]${NC} ${message} (${percent}%)"
}

# Box for important messages
box() {
    local message="$1"
    local color="${2:-$YELLOW}"
    local padding=2
    local line_length=${#message}
    local total_length=$((line_length + padding * 2 + 2))

    echo ""
    echo -e "${color}┌$(printf '─%.0s' $(seq 1 $total_length))┐${NC}"
    echo -e "${color}│  ${message}  │${NC}"
    echo -e "${color}└$(printf '─%.0s' $(seq 1 $total_length))┘${NC}"
    echo ""
}

# Spinner for long-running operations
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⣾⣽⣻⢿⡿⣟⣯⣷'
    while kill -0 "$pid" 2>/dev/null; do
        for ((i=0; i<${#spinstr}; i++)); do
            printf " [%c]  " "${spinstr:$i:1}"
            sleep $delay
            printf "\b\b\b\b\b\b"
        done
    done
    printf "    \b\b\b\b"
}

# Step counter for multi-step processes
declare -g STEP_CURRENT=0
declare -g STEP_TOTAL=0

step_init() {
    STEP_TOTAL="$1"
    STEP_CURRENT=0
}

step_next() {
    STEP_CURRENT=$((STEP_CURRENT + 1))
    echo ""
    echo -e "${BOLD}${CYAN}Step ${STEP_CURRENT}/${STEP_TOTAL}:${NC} ${BOLD}$1${NC}"
    echo ""
}

# Result display (for end of setup)
result() {
    local status="$1"
    local message="$2"
    if [ "$status" = "success" ]; then
        echo -e "  ${CHECK_MARK} ${message}"
    elif [ "$status" = "warning" ]; then
        echo -e "  ${WARNING_MARK} ${message}"
    elif [ "$status" = "error" ]; then
        echo -e "  ${CROSS_MARK} ${message}"
    else
        echo -e "  ${INFO_MARK} ${message}"
    fi
}
