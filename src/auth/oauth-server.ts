/**
 * OAuth 2.1 Authorization Server with Dynamic Client Registration (DCR)
 *
 * Implements:
 * - OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * - OAuth 2.0 Dynamic Client Registration Protocol (RFC 7591)
 * - OAuth 2.1 Authorization Code Flow with PKCE
 * - Token refresh
 *
 * This server acts as a transparent OAuth proxy: it mediates the OAuth flow
 * (DCR, authorize, callback, PKCE) but returns raw QuickBooks tokens to
 * clients. This means any client that obtains a QB token — whether through
 * this server's OAuth flow or directly from QuickBooks — can use it as a
 * Bearer token for MCP requests.
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import OAuthClient from "intuit-oauth";
import {
  OAuthClientRegistration,
  AuthorizationCode,
} from "../types/index.js";
import { AUTH_CODE_EXPIRY_SECONDS } from "../constants.js";

// In-memory stores for the authorization flow
const registeredClients = new Map<string, OAuthClientRegistration>();
const authorizationCodes = new Map<string, AuthorizationCode>();

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
const config = {
  issuer: process.env.OAUTH_ISSUER || "http://localhost:8000",
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

function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string = "S256"
): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }

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
   */
  router.get("/.well-known/oauth-protected-resource/mcp", (_req: Request, res: Response) => {
    res.json({
      resource: `${config.issuer}/mcp`,
      authorization_servers: [config.issuer],
      scopes_supported: ["com.intuit.quickbooks.accounting"],
      bearer_methods_supported: ["header"],
    });
  });

  /**
   * OAuth 2.0 Authorization Server Metadata (RFC 8414)
   */
  router.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
    res.json({
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
      scopes_supported: ["com.intuit.quickbooks.accounting"],
    });
  });

  /**
   * Dynamic Client Registration (RFC 7591)
   */
  router.post("/register", (req: Request, res: Response) => {
    const {
      client_name,
      redirect_uris,
      grant_types = ["authorization_code", "refresh_token"],
      response_types = ["code"],
      token_endpoint_auth_method = "none",
    } = req.body;

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      res.status(400).json({
        error: "invalid_client_metadata",
        error_description: "redirect_uris is required and must be a non-empty array",
      });
      return;
    }

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

    const client = registeredClients.get(client_id);
    if (!client) {
      res.status(400).json({
        error: "invalid_client",
        error_description: "Unknown client_id",
      });
      return;
    }

    if (!redirect_uri || !client.redirect_uris.includes(redirect_uri)) {
      res.status(400).json({
        error: "invalid_redirect_uri",
        error_description: "redirect_uri does not match registered URIs",
      });
      return;
    }

    if (!code_challenge) {
      const errorUrl = new URL(redirect_uri);
      errorUrl.searchParams.set("error", "invalid_request");
      errorUrl.searchParams.set("error_description", "code_challenge is required (PKCE)");
      if (state) errorUrl.searchParams.set("state", state);
      res.redirect(errorUrl.toString());
      return;
    }

    const internalState = generateSecureToken(16);
    pendingAuthorizations.set(internalState, {
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      scope,
    });

    const qbClient = getQBOAuthClient();
    const authUri = qbClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: internalState,
    });

    res.redirect(authUri);
  });

  /**
   * QuickBooks OAuth Callback
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
      const qbClient = getQBOAuthClient();
      const tokenResponse = await qbClient.createToken(req.url!);
      const qbTokens = tokenResponse.token;

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
   * Token Endpoint — transparent proxy
   *
   * Returns raw QuickBooks tokens. For authorization_code grants, the QB
   * tokens were already obtained during the callback. For refresh_token
   * grants, the raw QB refresh token is forwarded to QuickBooks.
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

    let clientId = bodyClientId;
    let clientSecret = bodyClientSecret;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Basic ")) {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
      const [id, secret] = decoded.split(":");
      clientId = clientId || id;
      clientSecret = clientSecret || secret;
    }

    console.error(`[/token] grant_type: ${grant_type}, client_id: ${clientId}`);

    if (grant_type === "authorization_code") {
      const client = registeredClients.get(clientId);
      if (!client) {
        console.error(`[/token] client not found for authorization_code grant`);
        res.status(401).json({
          error: "invalid_client",
          error_description: "Unknown client",
        });
        return;
      }

      if (client.token_endpoint_auth_method !== "none") {
        if (client.client_secret !== clientSecret) {
          res.status(401).json({
            error: "invalid_client",
            error_description: "Invalid client credentials",
          });
          return;
        }
      }

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

      if (authCode.client_id !== clientId) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Authorization code was not issued to this client",
        });
        return;
      }

      if (authCode.redirect_uri !== redirect_uri) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "redirect_uri does not match",
        });
        return;
      }

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

      if (Date.now() > authCode.expires_at) {
        authorizationCodes.delete(code);
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Authorization code has expired",
        });
        return;
      }

      authorizationCodes.delete(code);

      console.error(`[/token] Issuing transparent QB tokens for client ${clientId}, realm ${authCode.realm_id}`);

      res.json({
        access_token: authCode.qb_access_token,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: authCode.qb_refresh_token,
        scope: authCode.scope || "com.intuit.quickbooks.accounting",
      });
      return;
    }

    if (grant_type === "refresh_token") {
      if (!refresh_token) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "refresh_token is required",
        });
        return;
      }

      try {
        const qbClient = getQBOAuthClient();
        const refreshResponse = await qbClient.refreshUsingToken(refresh_token);
        const newTokens = refreshResponse.token;

        console.error(`[/token] Refreshed QB tokens`);

        res.json({
          access_token: newTokens.access_token,
          token_type: "Bearer",
          expires_in: newTokens.expires_in || 3600,
          refresh_token: newTokens.refresh_token,
          scope: "com.intuit.quickbooks.accounting",
        });
      } catch (err) {
        console.error("[/token] Failed to refresh QuickBooks token:", err);
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Failed to refresh token",
        });
      }
      return;
    }

    res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "Only authorization_code and refresh_token grants are supported",
    });
  });

  return router;
}
