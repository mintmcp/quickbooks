#!/usr/bin/env node
/**
 * QuickBooks MCP Server
 *
 * An MCP server for QuickBooks Online integration with OAuth 2.1 and
 * Dynamic Client Registration (DCR) support.
 *
 * Supports both:
 * - Streamable HTTP transport (for remote/OAuth scenarios)
 * - stdio transport (for local development)
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import QuickBooks from "node-quickbooks";
import { createOAuthRouter, getQuickBooksCredentials, validateAccessToken } from "./auth/oauth-server.js";
import { createQuickBooksInstance } from "./services/quickbooks-client.js";
import { registerAllTools } from "./tools/register-tools.js";

// Extend Express Request to include QuickBooks instance
declare global {
  namespace Express {
    interface Request {
      qb?: QuickBooks;
    }
  }
}

// Per-request QuickBooks instance (for HTTP transport)
let currentQBInstance: QuickBooks | null = null;

/**
 * Create and configure the MCP server
 */
function createMCPServer(): McpServer {
  const server = new McpServer({
    name: "quickbooks-mcp-server",
    version: "1.0.0",
  });

  // Register all QuickBooks tools
  registerAllTools(server, () => currentQBInstance);

  return server;
}

/**
 * Authentication middleware for MCP endpoints
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow unauthenticated initialize requests (MCP handshake / health probe)
  if (req.body?.method === "initialize") {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "unauthorized",
      error_description: "Bearer token required",
    });
    return;
  }

  const token = authHeader.slice(7);
  const tokenData = validateAccessToken(token);

  if (!tokenData) {
    res.status(401).json({
      error: "invalid_token",
      error_description: "Invalid or expired access token",
    });
    return;
  }

  const qbCreds = getQuickBooksCredentials(token);
  if (!qbCreds) {
    res.status(401).json({
      error: "invalid_token",
      error_description: "Token does not have QuickBooks credentials",
    });
    return;
  }

  // Create QuickBooks instance for this request
  req.qb = createQuickBooksInstance(
    qbCreds.accessToken,
    qbCreds.realmId,
    qbCreds.refreshToken
  );

  next();
}

/**
 * Run the server with Streamable HTTP transport (for remote/OAuth access)
 */
async function runHTTPServer(): Promise<void> {
  const app = express();
  app.use(cors());
  app.use((req, _res, next) => {
    console.error(`[${req.method}] ${req.path}`);
    next();
  });
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount OAuth endpoints
  app.use(createOAuthRouter());

  // MCP endpoint with authentication
  app.post("/mcp", authMiddleware, async (req: Request, res: Response) => {
    // Set the current QB instance for this request
    currentQBInstance = req.qb || null;

    try {
      // Create new transport for each request (stateless)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport.close();
        currentQBInstance = null;
      });

      const server = createMCPServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request error:", error);
      currentQBInstance = null;
      if (!res.headersSent) {
        res.status(500).json({
          error: "server_error",
          error_description: "Internal server error",
        });
      }
    }
  });

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", server: "quickbooks-mcp-server" });
  });

  const issuer = process.env.OAUTH_ISSUER || "http://localhost:8000";
  const port = new URL(issuer).port || (issuer.startsWith("https") ? 443 : 80);
  app.listen(port, () => {
    console.error(`QuickBooks MCP Server running at ${issuer}`);
    console.error(`OAuth metadata: ${issuer}/.well-known/oauth-authorization-server`);
    console.error(`MCP endpoint: ${issuer}/mcp`);
  });
}

/**
 * Run the server with stdio transport (for local development)
 *
 * In this mode, QuickBooks credentials are read from environment variables.
 */
async function runStdioServer(): Promise<void> {
  const accessToken = process.env.QUICKBOOKS_ACCESS_TOKEN;
  const refreshToken = process.env.QUICKBOOKS_REFRESH_TOKEN;
  const realmId = process.env.QUICKBOOKS_REALM_ID;

  if (!accessToken || !realmId) {
    console.error("ERROR: For stdio mode, set QUICKBOOKS_ACCESS_TOKEN and QUICKBOOKS_REALM_ID");
    console.error("       Or use HTTP mode for OAuth-based authentication");
    process.exit(1);
  }

  // Create a static QuickBooks instance for stdio mode
  currentQBInstance = createQuickBooksInstance(accessToken, realmId, refreshToken);

  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("QuickBooks MCP Server running via stdio");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const transport = process.env.TRANSPORT || "http";

  // Validate required QuickBooks app credentials
  if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET) {
    console.error("ERROR: QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET are required");
    console.error("       Set these in your environment or .env file");
    process.exit(1);
  }

  if (transport === "stdio") {
    await runStdioServer();
  } else {
    await runHTTPServer();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
