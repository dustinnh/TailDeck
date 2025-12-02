/**
 * Authentik API Client
 *
 * SERVER-ONLY: This file must NEVER be imported by client components.
 * It contains the API token and makes authenticated requests to Authentik.
 *
 * This client is used for:
 * - Auto-configuring OAuth2 providers during setup
 * - Managing RBAC groups
 * - Health checks
 */

import type { ZodType } from 'zod';

import { logger } from '@/lib/logger';

import {
  flowListResponseSchema,
  scopeMappingListResponseSchema,
  oauth2ProviderListResponseSchema,
  oauth2ProviderCreateResponseSchema,
  applicationListResponseSchema,
  applicationCreateResponseSchema,
  groupListResponseSchema,
  groupCreateResponseSchema,
  rootConfigSchema,
} from './schemas';
import type {
  OAuth2Provider,
  OAuth2ProviderCreateRequest,
  Application,
  ApplicationCreateRequest,
  Group,
  GroupCreateRequest,
  Flow,
  ScopeMapping,
  AuthentikSetupResult,
  AuthentikHealthStatus,
} from './types';

/**
 * Custom error class for Authentik API errors
 */
export class AuthentikClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AuthentikClientError';
  }
}

/**
 * Authentik API Client
 *
 * Provides type-safe access to the Authentik REST API v3 with:
 * - Bearer token authentication
 * - Request timeout handling
 * - Response validation with Zod
 * - Proper error handling and logging
 */
class AuthentikClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeout: number;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Get default headers for API requests
   */
  private get headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Make an authenticated request to the Authentik API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: ZodType<T>
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v3${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      logger.debug({ endpoint, method: options.method || 'GET' }, 'Authentik API request');

      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options.headers },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle error responses
      if (!response.ok) {
        let errorMessage = `Authentik API error: ${response.status}`;
        let errorCode: string | undefined;
        let fullErrorBody: Record<string, unknown> | null = null;

        try {
          fullErrorBody = (await response.json()) as Record<string, unknown>;
          const errorBody = fullErrorBody as {
            detail?: string;
            code?: string;
            non_field_errors?: string[];
          };
          errorMessage = errorBody.detail || errorBody.non_field_errors?.[0] || errorMessage;
          errorCode = errorBody.code;
        } catch {
          // Ignore JSON parse errors for error responses
        }

        logger.error(
          { statusCode: response.status, endpoint, errorCode, errorBody: fullErrorBody },
          `Authentik API error: ${errorMessage}`
        );

        throw new AuthentikClientError(errorMessage, response.status, errorCode);
      }

      // Handle 204 No Content (common for DELETE operations)
      if (response.status === 204) {
        return undefined as T;
      }

      // Parse response
      const data: unknown = await response.json();

      // Validate response against schema if provided
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          logger.error(
            { endpoint, errors: result.error.flatten() },
            'Authentik API response validation failed'
          );
          throw new AuthentikClientError(
            'Invalid response from Authentik API',
            500,
            'VALIDATION_ERROR'
          );
        }
        return result.data;
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw AuthentikClientError
      if (error instanceof AuthentikClientError) {
        throw error;
      }

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error({ endpoint }, 'Authentik API request timed out');
        throw new AuthentikClientError('Request timed out', 504, 'TIMEOUT');
      }

      // Handle other errors
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        { endpoint, error: errorMsg, errorType: error?.constructor?.name },
        'Authentik API request failed'
      );
      throw new AuthentikClientError(
        `Failed to connect to Authentik: ${errorMsg}`,
        503,
        'CONNECTION_ERROR'
      );
    }
  }

  // ============================================
  // Health & Config
  // ============================================

  /**
   * Check Authentik health and get version info
   */
  async checkHealth(): Promise<AuthentikHealthStatus> {
    try {
      const config = await this.request('/root/config/', {}, rootConfigSchema);
      return {
        healthy: true,
        apiReachable: true,
        version: config.version_current || config.version,
      };
    } catch (error) {
      if (error instanceof AuthentikClientError) {
        return {
          healthy: false,
          apiReachable: error.statusCode !== 503,
          error: error.message,
        };
      }
      return {
        healthy: false,
        apiReachable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================
  // Flow Operations
  // ============================================

  /**
   * List all flows
   */
  async listFlows(designation?: string): Promise<Flow[]> {
    const query = designation ? `?designation=${designation}` : '';
    const response = await this.request(`/flows/instances/${query}`, {}, flowListResponseSchema);
    return response.results;
  }

  /**
   * Get the default authorization flow
   */
  async getAuthorizationFlow(): Promise<Flow | null> {
    const flows = await this.listFlows('authorization');
    return (
      flows.find((f) => f.slug === 'default-provider-authorization-implicit-consent') ||
      flows[0] ||
      null
    );
  }

  /**
   * Wait for Authentik blueprints to initialize and flows to be available.
   * Authentik creates default flows from blueprints during startup, which can
   * take 30-45 seconds on lower-end VPS systems.
   *
   * @param maxAttempts - Maximum number of attempts (default: 30)
   * @param delayMs - Delay between attempts in milliseconds (default: 2000)
   * @param onProgress - Optional callback for progress updates
   * @returns true if flows are ready, false if timed out
   */
  async waitForFlowsReady(
    maxAttempts = 30,
    delayMs = 2000,
    onProgress?: (attempt: number, maxAttempts: number) => void
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const flow = await this.getAuthorizationFlow();
        if (flow) {
          return true;
        }
      } catch {
        // Ignore errors during wait - API might not be fully ready
      }

      if (onProgress) {
        onProgress(attempt, maxAttempts);
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return false;
  }

  // ============================================
  // Scope Mapping Operations
  // ============================================

  /**
   * List all scope mappings
   */
  async listScopeMappings(): Promise<ScopeMapping[]> {
    const response = await this.request(
      '/propertymappings/scope/',
      {},
      scopeMappingListResponseSchema
    );
    return response.results;
  }

  /**
   * Get scope mappings for OpenID Connect
   */
  async getOIDCScopeMappings(): Promise<string[]> {
    const mappings = await this.listScopeMappings();
    const requiredScopes = ['openid', 'profile', 'email', 'groups'];

    return mappings
      .filter((m) => requiredScopes.some((s) => m.scope_name === s || m.scope_name.endsWith(s)))
      .map((m) => m.pk);
  }

  // ============================================
  // OAuth2 Provider Operations
  // ============================================

  /**
   * List all OAuth2 providers
   */
  async listOAuth2Providers(): Promise<OAuth2Provider[]> {
    const response = await this.request('/providers/oauth2/', {}, oauth2ProviderListResponseSchema);
    return response.results;
  }

  /**
   * Get OAuth2 provider by name
   */
  async getOAuth2ProviderByName(name: string): Promise<OAuth2Provider | null> {
    const providers = await this.listOAuth2Providers();
    return providers.find((p) => p.name === name) || null;
  }

  /**
   * Create OAuth2 provider
   */
  async createOAuth2Provider(params: OAuth2ProviderCreateRequest): Promise<OAuth2Provider> {
    return this.request<OAuth2Provider>(
      '/providers/oauth2/',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      oauth2ProviderCreateResponseSchema
    );
  }

  /**
   * Update OAuth2 provider
   */
  async updateOAuth2Provider(
    pk: number,
    params: Partial<OAuth2ProviderCreateRequest>
  ): Promise<OAuth2Provider> {
    return this.request<OAuth2Provider>(
      `/providers/oauth2/${pk}/`,
      {
        method: 'PATCH',
        body: JSON.stringify(params),
      },
      oauth2ProviderCreateResponseSchema
    );
  }

  // ============================================
  // Application Operations
  // ============================================

  /**
   * List all applications
   */
  async listApplications(): Promise<Application[]> {
    const response = await this.request('/core/applications/', {}, applicationListResponseSchema);
    return response.results;
  }

  /**
   * Get application by slug
   */
  async getApplicationBySlug(slug: string): Promise<Application | null> {
    const apps = await this.listApplications();
    return apps.find((a) => a.slug === slug) || null;
  }

  /**
   * Create application
   */
  async createApplication(params: ApplicationCreateRequest): Promise<Application> {
    return this.request<Application>(
      '/core/applications/',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      applicationCreateResponseSchema
    );
  }

  // ============================================
  // Group Operations
  // ============================================

  /**
   * List all groups
   */
  async listGroups(): Promise<Group[]> {
    const response = await this.request('/core/groups/', {}, groupListResponseSchema);
    return response.results;
  }

  /**
   * Get group by name
   */
  async getGroupByName(name: string): Promise<Group | null> {
    const groups = await this.listGroups();
    return groups.find((g) => g.name === name) || null;
  }

  /**
   * Create group
   */
  async createGroup(params: GroupCreateRequest): Promise<Group> {
    return this.request<Group>(
      '/core/groups/',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      groupCreateResponseSchema
    );
  }

  // ============================================
  // Setup Automation
  // ============================================

  /**
   * Full automated setup for TailDeck OAuth2 integration
   */
  async setupTailDeck(
    redirectUri: string,
    clientId: string = 'taildeck'
  ): Promise<AuthentikSetupResult> {
    const createdGroups: string[] = [];

    try {
      // 1. Get authorization flow
      logger.info('Getting authorization flow...');
      const flow = await this.getAuthorizationFlow();
      if (!flow) {
        throw new Error('No authorization flow found');
      }

      // 2. Get scope mappings
      logger.info('Getting scope mappings...');
      const scopeMappings = await this.getOIDCScopeMappings();
      if (scopeMappings.length === 0) {
        throw new Error('No scope mappings found');
      }

      // 3. Check for existing provider and create/update as needed
      // Always generate a new secret so we can save it to .env.local
      const clientSecret = this.generateClientSecret();
      let provider = await this.getOAuth2ProviderByName('TailDeck OAuth2');

      if (provider) {
        // Update existing provider with new secret
        logger.info('Updating existing OAuth2 provider with new secret...');
        provider = await this.updateOAuth2Provider(provider.pk, {
          client_secret: clientSecret,
          redirect_uris: redirectUri,
          property_mappings: scopeMappings,
        });
      } else {
        // Create new provider
        logger.info('Creating OAuth2 provider...');
        provider = await this.createOAuth2Provider({
          name: 'TailDeck OAuth2',
          authorization_flow: flow.pk,
          client_type: 'confidential',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uris: redirectUri,
          access_token_validity: 'minutes=10',
          refresh_token_validity: 'days=30',
          include_claims_in_id_token: true,
          property_mappings: scopeMappings,
        });
      }

      // 4. Check/create application
      let app = await this.getApplicationBySlug('taildeck');
      if (!app) {
        logger.info('Creating application...');
        app = await this.createApplication({
          name: 'TailDeck',
          slug: 'taildeck',
          provider: provider.pk,
          policy_engine_mode: 'any',
        });
      } else {
        logger.info('Application already exists');
      }

      // 5. Create RBAC groups
      const rbacGroups = [
        'TailDeck Admins',
        'TailDeck Operators',
        'TailDeck Auditors',
        'TailDeck Users',
      ];

      for (const groupName of rbacGroups) {
        const existing = await this.getGroupByName(groupName);
        if (!existing) {
          logger.info(`Creating group: ${groupName}`);
          await this.createGroup({ name: groupName, is_superuser: false });
          createdGroups.push(groupName);
        } else {
          logger.info(`Group already exists: ${groupName}`);
        }
      }

      return {
        success: true,
        providerId: provider.pk,
        applicationSlug: app.slug,
        clientId,
        clientSecret,
        groups: rbacGroups,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error }, `Authentik setup failed: ${message}`);

      return {
        success: false,
        clientId,
        groups: createdGroups,
        error: message,
      };
    }
  }

  /**
   * Generate a secure client secret
   */
  private generateClientSecret(): string {
    // Generate 32 random bytes and convert to hex
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

// Singleton instance (lazy initialization)
let clientInstance: AuthentikClient | null = null;

/**
 * Get the Authentik client instance
 * Uses AUTHENTIK_URL and AUTHENTIK_BOOTSTRAP_TOKEN from environment
 */
export function getAuthentikClient(): AuthentikClient {
  if (!clientInstance) {
    const url = process.env.AUTHENTIK_URL || 'http://localhost:9000';
    const token = process.env.AUTHENTIK_BOOTSTRAP_TOKEN;

    if (!token) {
      throw new Error('AUTHENTIK_BOOTSTRAP_TOKEN is required for Authentik API access');
    }

    clientInstance = new AuthentikClient(url, token);
  }

  return clientInstance;
}

/**
 * Create a new Authentik client with custom credentials
 */
export function createAuthentikClient(baseUrl: string, token: string): AuthentikClient {
  return new AuthentikClient(baseUrl, token);
}
