// Type definitions for QuickBooks MCP Server

export interface OAuthClientRegistration {
  client_id: string;
  client_secret?: string;
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  created_at: number;
}

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  expires_at: number;
  user_id?: string;
  realm_id?: string;
  qb_access_token?: string;
  qb_refresh_token?: string;
}

export interface TokenData {
  client_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  realm_id?: string;
  qb_access_token?: string;
  qb_refresh_token?: string;
}

export interface ToolResponse<T> {
  result: T | null;
  isError: boolean;
  error: string | null;
}

export interface QuickBooksFilter {
  field: string;
  value: unknown;
  operator?: string;
}

export interface SearchOptions {
  filters?: QuickBooksFilter[];
  asc?: string;
  desc?: string;
  limit?: number;
  offset?: number;
  count?: boolean;
  fetchAll?: boolean;
}
