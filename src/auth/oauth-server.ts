/**
 * OAuth 2.1 Authorization Server with Dynamic Client Registration (DCR)
 *
 * Implements:
 * - OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * - OAuth 2.0 Dynamic Client Registration Protocol (RFC 7591)
 * - OAuth 2.1 Authorization Code Flow with PKCE
 * - Token refresh
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import OAuthClient from "intuit-oauth";
import {
  OAuthClientRegistration,
  AuthorizationCode,
  TokenData,
} from "../types/index.js";
import { TOKEN_EXPIRY_SECONDS, AUTH_CODE_EXPIRY_SECONDS } from "../constants.js";

// In-memory stores (in production, use a database)
const registeredClients = new Map<string, OAuthClientRegistration>();
const authorizationCodes = new Map<string, AuthorizationCode>();
const accessTokens = new Map<string, TokenData>();
const refreshTokens = new Map<string, TokenData>();

// Pending authorization states for QuickBooks OAuth flow
const pendingAuthorizations = new Map<string, {
  client_id: string;
  redirect_uri: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
}>();

// Configuration
const port = process.env.PORT || "3000";
const config = {
  issuer: process.env.OAUTH_ISSUER || `http://localhost:${port}`,
  quickbooksClientId: process.env.QUICKBOOKS_CLIENT_ID || "",
  quickbooksClientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || "",
  quickbooksEnvironment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
};

// QuickBooks OAuth client
let qbOAuthClient: OAuthClient | null = null;

function getQBOAuthClient(): OAuthClient {
  if (!qbOAuthClient) {
    qbOAuthClient = new OAuthClient({
      clientId: config.quickbooksClientId,
      clientSecret: config.quickbooksClientSecret,
      environment: config.quickbooksEnvironment,
      redirectUri: `${config.issuer}/callback`,
    });
  }
  return qbOAuthClient;
}

/**
 * Generate a secure random string
 */
function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Verify PKCE code challenge
 */
function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string = "S256"
): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }

  // S256 method
  const hash = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return hash === codeChallenge;
}

export function createOAuthRouter(): Router {
  const router = Router();

  /**
   * OAuth 2.0 Protected Resource Metadata (RFC 9728)
   * GET /.well-known/oauth-protected-resource
   *
   * This tells MCP clients where to find the authorization server.
   */
  router.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
    const metadata = {
      resource: `${config.issuer}/mcp`,
      authorization_servers: [config.issuer],
      scopes_supported: ["quickbooks:accounting"],
      bearer_methods_supported: ["header"],
    };
    res.json(metadata);
  });

  /**
   * OAuth 2.0 Authorization Server Metadata (RFC 8414)
   * GET /.well-known/oauth-authorization-server
   */
  router.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
    const metadata = {
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/authorize`,
      token_endpoint: `${config.issuer}/token`,
      registration_endpoint: `${config.issuer}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
      code_challenge_methods_supported: ["S256", "plain"],
      scopes_supported: ["quickbooks:accounting"],
    };
    res.json(metadata);
  });

  /**
   * Dynamic Client Registration (RFC 7591)
   * POST /register
   */
  router.post("/register", (req: Request, res: Response) => {
    const {
      client_name,
      redirect_uris,
      grant_types = ["authorization_code", "refresh_token"],
      response_types = ["code"],
      token_endpoint_auth_method = "none",
    } = req.body;

    // Validate redirect URIs
    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      res.status(400).json({
        error: "invalid_client_metadata",
        error_description: "redirect_uris is required and must be a non-empty array",
      });
      return;
    }

    // Validate redirect URIs are localhost or HTTPS
    for (const uri of redirect_uris) {
      try {
        const url = new URL(uri);
        const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
        const isHttps = url.protocol === "https:";
        if (!isLocalhost && !isHttps) {
          res.status(400).json({
            error: "invalid_redirect_uri",
            error_description: "Redirect URIs must be localhost URLs or HTTPS URLs",
          });
          return;
        }
      } catch {
        res.status(400).json({
          error: "invalid_redirect_uri",
          error_description: `Invalid redirect URI: ${uri}`,
        });
        return;
      }
    }

    const clientId = uuidv4();
    const clientSecret = token_endpoint_auth_method !== "none"
      ? generateSecureToken(32)
      : undefined;

    const registration: OAuthClientRegistration = {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: client_name || `MCP Client ${clientId.substring(0, 8)}`,
      redirect_uris,
      grant_types,
      response_types,
      token_endpoint_auth_method,
      created_at: Date.now(),
    };

    registeredClients.set(clientId, registration);
    console.error(`[/register] Registered client: ${clientId}`);

    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_name: registration.client_name,
      redirect_uris,
      grant_types,
      response_types,
      token_endpoint_auth_method,
      client_id_issued_at: Math.floor(registration.created_at / 1000),
    });
  });

  /**
   * Authorization Endpoint
   * GET /authorize
   */
  router.get("/authorize", (req: Request, res: Response) => {
    const {
      response_type,
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method = "S256",
      scope,
    } = req.query as Record<string, string>;

    // Validate required parameters
    if (response_type !== "code") {
      res.status(400).json({
        error: "unsupported_response_type",
        error_description: "Only 'code' response type is supported",
      });
      return;
    }

    if (!client_id) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "client_id is required",
      });
      return;
    }

    // Look up client registration
    const client = registeredClients.get(client_id);
    if (!client) {
      res.status(400).json({
        error: "invalid_client",
        error_description: "Unknown client_id",
      });
      return;
    }

    // Validate redirect URI
    if (!redirect_uri || !client.redirect_uris.includes(redirect_uri)) {
      res.status(400).json({
        error: "invalid_redirect_uri",
        error_description: "redirect_uri does not match registered URIs",
      });
      return;
    }

    // PKCE is required
    if (!code_challenge) {
      const errorUrl = new URL(redirect_uri);
      errorUrl.searchParams.set("error", "invalid_request");
      errorUrl.searchParams.set("error_description", "code_challenge is required (PKCE)");
      if (state) errorUrl.searchParams.set("state", state);
      res.redirect(errorUrl.toString());
      return;
    }

    // Store pending authorization and redirect to QuickBooks
    const internalState = generateSecureToken(16);
    pendingAuthorizations.set(internalState, {
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      scope,
    });

    // Redirect to QuickBooks OAuth
    const qbClient = getQBOAuthClient();
    const authUri = qbClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: internalState,
    });

    res.redirect(authUri);
  });

  /**
   * QuickBooks OAuth Callback
   * GET /callback
   */
  router.get("/callback", async (req: Request, res: Response) => {
    const { code, state: internalState, realmId, error, error_description } = req.query as Record<string, string>;

    const pending = pendingAuthorizations.get(internalState);
    if (!pending) {
      res.status(400).send("Invalid or expired authorization state");
      return;
    }

    pendingAuthorizations.delete(internalState);

    const clientRedirectUri = new URL(pending.redirect_uri);

    // Handle QuickBooks errors
    if (error) {
      clientRedirectUri.searchParams.set("error", error);
      if (error_description) {
        clientRedirectUri.searchParams.set("error_description", error_description);
      }
      if (pending.state) clientRedirectUri.searchParams.set("state", pending.state);
      res.redirect(clientRedirectUri.toString());
      return;
    }

    try {
      // Exchange code for QuickBooks tokens
      const qbClient = getQBOAuthClient();
      const tokenResponse = await qbClient.createToken(req.url!);
      const qbTokens = tokenResponse.token;

      // Generate our own authorization code
      const authCode = generateSecureToken(32);
      const authCodeData: AuthorizationCode = {
        code: authCode,
        client_id: pending.client_id,
        redirect_uri: pending.redirect_uri,
        code_challenge: pending.code_challenge,
        code_challenge_method: pending.code_challenge_method,
        scope: pending.scope,
        expires_at: Date.now() + AUTH_CODE_EXPIRY_SECONDS * 1000,
        realm_id: realmId || qbTokens.realmId,
        qb_access_token: qbTokens.access_token,
        qb_refresh_token: qbTokens.refresh_token,
      };

      authorizationCodes.set(authCode, authCodeData);

      // Redirect back to client with our authorization code
      clientRedirectUri.searchParams.set("code", authCode);
      if (pending.state) clientRedirectUri.searchParams.set("state", pending.state);

      res.redirect(clientRedirectUri.toString());
    } catch (err) {
      console.error("QuickBooks token exchange error:", err);
      clientRedirectUri.searchParams.set("error", "server_error");
      clientRedirectUri.searchParams.set("error_description", "Failed to complete QuickBooks authorization");
      if (pending.state) clientRedirectUri.searchParams.set("state", pending.state);
      res.redirect(clientRedirectUri.toString());
    }
  });

  /**
   * Token Endpoint
   * POST /token
   */
  router.post("/token", async (req: Request, res: Response) => {
    const {
      grant_type,
      code,
      redirect_uri,
      code_verifier,
      refresh_token,
      client_id: bodyClientId,
      client_secret: bodyClientSecret,
    } = req.body;

    // Extract client credentials (Basic auth or body)
    let clientId = bodyClientId;
    let clientSecret = bodyClientSecret;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Basic ")) {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
      const [id, secret] = decoded.split(":");
      clientId = clientId || id;
      clientSecret = clientSecret || secret;
    }

    // Validate client
    console.error(`[/token] client_id from body: ${bodyClientId}`);
    console.error(`[/token] client_id from auth header: ${authHeader?.startsWith("Basic ") ? "present" : "none"}`);
    console.error(`[/token] resolved client_id: ${clientId}`);
    console.error(`[/token] registered clients: ${Array.from(registeredClients.keys()).join(", ")}`);

    const client = registeredClients.get(clientId);
    if (!client) {
      console.error(`[/token] client not found!`);
      res.status(401).json({
        error: "invalid_client",
        error_description: "Unknown client",
      });
      return;
    }

    // Verify client secret if required
    if (client.token_endpoint_auth_method !== "none") {
      if (client.client_secret !== clientSecret) {
        res.status(401).json({
          error: "invalid_client",
          error_description: "Invalid client credentials",
        });
        return;
      }
    }

    if (grant_type === "authorization_code") {
      // Authorization Code Grant
      if (!code) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "code is required",
        });
        return;
      }

      const authCode = authorizationCodes.get(code);
      if (!authCode) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Invalid or expired authorization code",
        });
        return;
      }

      // Verify the code belongs to this client
      if (authCode.client_id !== clientId) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Authorization code was not issued to this client",
        });
        return;
      }

      // Verify redirect URI matches
      if (authCode.redirect_uri !== redirect_uri) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "redirect_uri does not match",
        });
        return;
      }

      // Verify PKCE
      if (authCode.code_challenge) {
        if (!code_verifier) {
          res.status(400).json({
            error: "invalid_request",
            error_description: "code_verifier is required",
          });
          return;
        }

        if (!verifyCodeChallenge(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
          res.status(400).json({
            error: "invalid_grant",
            error_description: "Invalid code_verifier",
          });
          return;
        }
      }

      // Check expiry
      if (Date.now() > authCode.expires_at) {
        authorizationCodes.delete(code);
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Authorization code has expired",
        });
        return;
      }

      // Delete the authorization code (single use)
      authorizationCodes.delete(code);

      // Generate tokens
      const accessToken = generateSecureToken(32);
      const newRefreshToken = generateSecureToken(32);

      const tokenData: TokenData = {
        client_id: clientId,
        access_token: accessToken,
        refresh_token: newRefreshToken,
        expires_at: Date.now() + TOKEN_EXPIRY_SECONDS * 1000,
        realm_id: authCode.realm_id,
        qb_access_token: authCode.qb_access_token,
        qb_refresh_token: authCode.qb_refresh_token,
      };

      accessTokens.set(accessToken, tokenData);
      refreshTokens.set(newRefreshToken, tokenData);

      res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: TOKEN_EXPIRY_SECONDS,
        refresh_token: newRefreshToken,
        scope: authCode.scope || "quickbooks:accounting",
      });
      return;
    }

    if (grant_type === "refresh_token") {
      // Refresh Token Grant
      if (!refresh_token) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "refresh_token is required",
        });
        return;
      }

      const existingTokenData = refreshTokens.get(refresh_token);
      if (!existingTokenData) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Invalid refresh token",
        });
        return;
      }

      if (existingTokenData.client_id !== clientId) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Refresh token was not issued to this client",
        });
        return;
      }

      // Refresh QuickBooks tokens if needed
      let qbAccessToken = existingTokenData.qb_access_token;
      let qbRefreshToken = existingTokenData.qb_refresh_token;

      if (qbRefreshToken) {
        try {
          const qbClient = getQBOAuthClient();
          const refreshResponse = await qbClient.refreshUsingToken(qbRefreshToken);
          qbAccessToken = refreshResponse.token.access_token;
          qbRefreshToken = refreshResponse.token.refresh_token;
        } catch (err) {
          console.error("Failed to refresh QuickBooks token:", err);
          // Continue with existing tokens - they may still work
        }
      }

      // Delete old tokens
      accessTokens.delete(existingTokenData.access_token);
      refreshTokens.delete(refresh_token);

      // Generate new tokens
      const newAccessToken = generateSecureToken(32);
      const newRefreshToken = generateSecureToken(32);

      const newTokenData: TokenData = {
        client_id: clientId,
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: Date.now() + TOKEN_EXPIRY_SECONDS * 1000,
        realm_id: existingTokenData.realm_id,
        qb_access_token: qbAccessToken,
        qb_refresh_token: qbRefreshToken,
      };

      accessTokens.set(newAccessToken, newTokenData);
      refreshTokens.set(newRefreshToken, newTokenData);

      res.json({
        access_token: newAccessToken,
        token_type: "Bearer",
        expires_in: TOKEN_EXPIRY_SECONDS,
        refresh_token: newRefreshToken,
        scope: "quickbooks:accounting",
      });
      return;
    }

    res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "Only authorization_code and refresh_token grants are supported",
    });
  });

  return router;
}

/**
 * Validate an access token and return the associated token data
 */
export function validateAccessToken(token: string): TokenData | null {
  const tokenData = accessTokens.get(token);
  if (!tokenData) return null;

  if (Date.now() > tokenData.expires_at) {
    accessTokens.delete(token);
    return null;
  }

  return tokenData;
}

/**
 * Get QuickBooks credentials from a valid access token
 */
export function getQuickBooksCredentials(token: string): {
  realmId: string;
  accessToken: string;
  refreshToken?: string;
} | null {
  const tokenData = validateAccessToken(token);
  if (!tokenData || !tokenData.realm_id || !tokenData.qb_access_token) {
    return null;
  }

  return {
    realmId: tokenData.realm_id,
    accessToken: tokenData.qb_access_token,
    refreshToken: tokenData.qb_refresh_token,
  };
}
