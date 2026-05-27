/**
 * Connector Adapter Interface
 *
 * Defines the contract for third-party connector/integration operations.
 * Implementations can swap between Composio SDK and alternative connector providers.
 */

export interface ConnectorConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface OAuthInitiation {
  redirectUrl: string;
  state: string;
  codeVerifier?: string;
}

export interface OAuthCallback {
  code: string;
  state: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export interface ConnectorAccount {
  id: string;
  connectorId: string;
  userId: string;
  accountIdentifier?: string;
  status: "active" | "expired" | "revoked";
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  category?: string;
}

export interface ToolExecution {
  toolId: string;
  parameters: Record<string, unknown>;
  accountId: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime?: number;
}

export interface Connector {
  id: string;
  name: string;
  description?: string;
  category?: string;
  iconUrl?: string;
  authType: "oauth2" | "api_key" | "basic";
  isEnabled: boolean;
}

export interface IConnectorAdapter {
  /**
   * Initialize OAuth flow for a connector
   */
  initiateOAuth(connectorId: string, userId: string, redirectUri: string): Promise<OAuthInitiation>;

  /**
   * Complete OAuth flow and exchange code for tokens
   */
  completeOAuth(connectorId: string, callback: OAuthCallback): Promise<OAuthTokens>;

  /**
   * Refresh expired access token
   */
  refreshToken(accountId: string, refreshToken: string): Promise<OAuthTokens>;

  /**
   * Revoke access token and disconnect account
   */
  revokeAccess(accountId: string): Promise<void>;

  /**
   * Get all connected accounts for a user
   */
  getConnectedAccounts(userId: string): Promise<ConnectorAccount[]>;

  /**
   * Get available connectors from catalog
   */
  getConnectors(category?: string): Promise<Connector[]>;

  /**
   * Get connector details by ID
   */
  getConnector(connectorId: string): Promise<Connector>;

  /**
   * Get available tools for a connected account
   */
  getTools(accountId: string): Promise<Tool[]>;

  /**
   * Execute a tool with given parameters
   */
  executeTool(execution: ToolExecution): Promise<ToolExecutionResult>;

  /**
   * Search tools by name or description
   */
  searchTools(accountId: string, query: string): Promise<Tool[]>;

  /**
   * Validate connector credentials
   */
  validateCredentials(accountId: string): Promise<boolean>;
}
