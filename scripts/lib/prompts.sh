#!/bin/bash
#
# Interactive prompt functions for TailDeck setup
#

# Source colors if not already loaded
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/colors.sh" 2>/dev/null || true

# Prompt for a text input with optional default and validation
# Usage: prompt_input "Enter domain:" "example.com" DOMAIN_VAR "validate_domain"
prompt_input() {
    local prompt_text="$1"
    local default_value="$2"
    local result_var="$3"
    local validator="$4"

    local value=""
    local is_valid=false

    while [ "$is_valid" = false ]; do
        if [ -n "$default_value" ]; then
            echo -en "${CYAN}${prompt_text}${NC} [${default_value}]: "
        else
            echo -en "${CYAN}${prompt_text}${NC}: "
        fi

        read -r value

        # Use default if empty
        if [ -z "$value" ] && [ -n "$default_value" ]; then
            value="$default_value"
        fi

        # Validate if validator provided
        if [ -n "$validator" ]; then
            if $validator "$value"; then
                is_valid=true
            else
                log_error "Invalid input. Please try again."
            fi
        else
            # No validator, accept any non-empty input
            if [ -n "$value" ]; then
                is_valid=true
            else
                log_error "This field is required."
            fi
        fi
    done

    # Set the result variable
    eval "$result_var='$value'"
}

# Prompt for a password (hidden input)
# Usage: prompt_password "Enter password:" PASSWORD_VAR 12
prompt_password() {
    local prompt_text="$1"
    local result_var="$2"
    local min_length="${3:-8}"

    local password=""
    local password_confirm=""
    local is_valid=false

    while [ "$is_valid" = false ]; do
        echo -en "${CYAN}${prompt_text}${NC}: "
        read -rs password
        echo ""

        if [ ${#password} -lt $min_length ]; then
            log_error "Password must be at least ${min_length} characters."
            continue
        fi

        echo -en "${CYAN}Confirm password${NC}: "
        read -rs password_confirm
        echo ""

        if [ "$password" != "$password_confirm" ]; then
            log_error "Passwords do not match. Please try again."
        else
            is_valid=true
        fi
    done

    eval "$result_var='$password'"
}

# Prompt for yes/no confirmation
# Usage: prompt_confirm "Continue with setup?" "y" && echo "Confirmed"
prompt_confirm() {
    local prompt_text="$1"
    local default="${2:-n}"

    local options
    if [ "$default" = "y" ] || [ "$default" = "Y" ]; then
        options="[Y/n]"
    else
        options="[y/N]"
    fi

    echo -en "${CYAN}${prompt_text}${NC} ${options}: "
    read -r response

    if [ -z "$response" ]; then
        response="$default"
    fi

    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Prompt for selection from a list
# Usage: prompt_select "Choose environment:" "development production" SELECTED_VAR
prompt_select() {
    local prompt_text="$1"
    local options_str="$2"
    local result_var="$3"
    local default="${4:-}"

    # Convert string to array
    IFS=' ' read -ra options <<< "$options_str"

    echo -e "${CYAN}${prompt_text}${NC}"
    echo ""

    local i=1
    for option in "${options[@]}"; do
        if [ "$option" = "$default" ]; then
            echo -e "  ${GREEN}${i})${NC} ${option} ${DIM}(default)${NC}"
        else
            echo -e "  ${CYAN}${i})${NC} ${option}"
        fi
        i=$((i + 1))
    done
    echo ""

    local selection=""
    local is_valid=false

    while [ "$is_valid" = false ]; do
        echo -en "${CYAN}Enter choice (1-${#options[@]}):${NC} "
        read -r selection

        # Use default if empty
        if [ -z "$selection" ] && [ -n "$default" ]; then
            for idx in "${!options[@]}"; do
                if [ "${options[$idx]}" = "$default" ]; then
                    selection=$((idx + 1))
                    break
                fi
            done
        fi

        # Validate selection
        if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le "${#options[@]}" ]; then
            is_valid=true
        else
            log_error "Please enter a number between 1 and ${#options[@]}"
        fi
    done

    local selected_value="${options[$((selection - 1))]}"
    eval "$result_var='$selected_value'"
}

# Prompt for URL with validation
# Usage: prompt_url "Enter domain URL:" "https://example.com" URL_VAR
prompt_url() {
    local prompt_text="$1"
    local default_value="$2"
    local result_var="$3"

    prompt_input "$prompt_text" "$default_value" "$result_var" "validate_url"
}

# Prompt for email with validation
# Usage: prompt_email "Enter admin email:" "" EMAIL_VAR
prompt_email() {
    local prompt_text="$1"
    local default_value="$2"
    local result_var="$3"

    prompt_input "$prompt_text" "$default_value" "$result_var" "validate_email"
}

# Prompt for domain (hostname) with validation
# Usage: prompt_domain "Enter domain:" "example.com" DOMAIN_VAR
prompt_domain() {
    local prompt_text="$1"
    local default_value="$2"
    local result_var="$3"

    prompt_input "$prompt_text" "$default_value" "$result_var" "validate_domain"
}

# Interactive menu with arrow key navigation (fallback to number selection if no tty)
prompt_menu() {
    local prompt_text="$1"
    local options_str="$2"
    local result_var="$3"

    # Use simple selection if not a terminal
    if ! [ -t 0 ]; then
        prompt_select "$prompt_text" "$options_str" "$result_var"
        return
    fi

    # Otherwise use the simple numbered selection
    prompt_select "$prompt_text" "$options_str" "$result_var"
}

# Display configuration summary for confirmation
config_summary() {
    echo ""
    echo -e "${BOLD}${WHITE}Configuration Summary:${NC}"
    echo -e "${DIM}──────────────────────────────────────${NC}"

    local key value
    while [ $# -ge 2 ]; do
        key="$1"
        value="$2"
        shift 2
        echo -e "  ${CYAN}${key}:${NC} ${value}"
    done

    echo -e "${DIM}──────────────────────────────────────${NC}"
    echo ""
}

# Collect all setup configuration interactively
collect_setup_config() {
    header "TailDeck Configuration"

    echo -e "This wizard will help you configure TailDeck for deployment."
    echo -e "Press ${CYAN}Enter${NC} to accept default values shown in ${DIM}[brackets]${NC}."
    echo ""

    # Environment selection
    prompt_select "Select environment:" "development production" TAILDECK_ENV "development"

    # Determine defaults based on environment
    if [ "$TAILDECK_ENV" = "production" ]; then
        DEFAULT_SCHEME="https"
        DEFAULT_DOMAIN=""
    else
        DEFAULT_SCHEME="http"
        DEFAULT_DOMAIN="localhost"
    fi

    subheader "Domain Configuration"

    # URL scheme
    prompt_select "URL scheme:" "https http" URL_SCHEME "$DEFAULT_SCHEME"

    # Domain name
    prompt_domain "TailDeck domain name (without protocol):" "$DEFAULT_DOMAIN" TAILDECK_DOMAIN

    # Build AUTH_URL
    AUTH_URL="${URL_SCHEME}://${TAILDECK_DOMAIN}"
    if [ "$TAILDECK_ENV" = "development" ]; then
        AUTH_URL="${URL_SCHEME}://${TAILDECK_DOMAIN}:3000"
    fi

    # Headscale URL
    if [ "$TAILDECK_ENV" = "development" ]; then
        DEFAULT_HEADSCALE_URL="http://localhost:8080"
    else
        DEFAULT_HEADSCALE_URL="${URL_SCHEME}://headscale.${TAILDECK_DOMAIN}"
    fi
    prompt_url "Headscale public URL:" "$DEFAULT_HEADSCALE_URL" HEADSCALE_URL

    subheader "MagicDNS Configuration"

    prompt_confirm "Enable MagicDNS?" "y" && MAGIC_DNS_ENABLED="true" || MAGIC_DNS_ENABLED="false"

    if [ "$MAGIC_DNS_ENABLED" = "true" ]; then
        if [ "$TAILDECK_ENV" = "development" ]; then
            DEFAULT_MAGIC_DNS_DOMAIN="taildeck.local"
        else
            DEFAULT_MAGIC_DNS_DOMAIN="tail.${TAILDECK_DOMAIN}"
        fi
        prompt_domain "MagicDNS base domain:" "$DEFAULT_MAGIC_DNS_DOMAIN" MAGIC_DNS_DOMAIN
    else
        MAGIC_DNS_DOMAIN=""
    fi

    subheader "Admin Account"

    prompt_email "Admin email address:" "" ADMIN_EMAIL
    prompt_password "Admin password (min 12 chars):" ADMIN_PASSWORD 12

    # Display summary
    config_summary \
        "Environment" "$TAILDECK_ENV" \
        "TailDeck URL" "$AUTH_URL" \
        "Headscale URL" "$HEADSCALE_URL" \
        "MagicDNS" "$MAGIC_DNS_ENABLED" \
        "MagicDNS Domain" "${MAGIC_DNS_DOMAIN:-N/A}" \
        "Admin Email" "$ADMIN_EMAIL"

    prompt_confirm "Proceed with this configuration?" "y" || {
        log_warn "Setup cancelled."
        exit 1
    }

    # Export all variables
    export TAILDECK_ENV
    export URL_SCHEME
    export TAILDECK_DOMAIN
    export AUTH_URL
    export HEADSCALE_URL
    export MAGIC_DNS_ENABLED
    export MAGIC_DNS_DOMAIN
    export ADMIN_EMAIL
    export ADMIN_PASSWORD
}
