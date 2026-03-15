#!/usr/bin/env node
/**
 * kroger-mcp-server
 *
 * MCP server for the Kroger Public API.
 * Public tools: product search, product details, store locations.
 * User tools:   login, profile, add to cart, logout.
 *
 * Required environment variables:
 *   KROGER_CLIENT_ID      – OAuth client ID from developer.kroger.com
 *   KROGER_CLIENT_SECRET  – OAuth client secret
 *
 * Optional:
 *   KROGER_REDIRECT_URI   – OAuth callback URL (default: http://localhost:3001/auth/callback)
 *   TRANSPORT             – 'stdio' (default) or 'http'
 *   PORT                  – MCP HTTP port when TRANSPORT=http (default: 3000)
 *   AUTH_PORT             – OAuth callback listener port (default: 3001)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { KrogerApiClient } from "./services/kroger-client.js";
import { UserAuthService } from "./services/user-auth.js";
import { registerProductTools } from "./tools/products.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerUserTools } from "./tools/user.js";

// ── Validate environment ──────────────────────────────────────────────────────

const clientId = process.env.KROGER_CLIENT_ID;
const clientSecret = process.env.KROGER_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "❌ Missing required environment variables:\n" +
      "  KROGER_CLIENT_ID and KROGER_CLIENT_SECRET must be set.\n\n" +
      "  Register at https://developer.kroger.com/manage/apps/register\n" +
      "  to obtain your credentials."
  );
  process.exit(1);
}

// ── Shared service instances ──────────────────────────────────────────────────

const krogerClient = new KrogerApiClient(clientId, clientSecret);
const userAuth = new UserAuthService(clientId, clientSecret);

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "kroger-mcp-server",
  version: "2.0.0",
});

registerProductTools(server, krogerClient);
registerLocationTools(server, krogerClient);
registerUserTools(server, userAuth);

// ── OAuth callback server (always starts, any transport) ─────────────────────
//
// This lightweight Express app listens on AUTH_PORT (default 3001) exclusively
// to receive the redirect from Kroger after the user logs in.
// It is separate from the MCP HTTP transport so it works even in stdio mode.

function startAuthCallbackServer(): void {
  const authApp = express();
  const authPort = parseInt(process.env.AUTH_PORT ?? "3001", 10);

  authApp.get("/auth/callback", async (req, res) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const error = req.query.error as string | undefined;

    if (error) {
      res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:2rem;">
          <h2>❌ Login Failed</h2>
          <p>Kroger returned an error: <strong>${error}</strong></p>
          <p>You can close this tab and try <code>kroger_login</code> again.</p>
        </body></html>
      `);
      return;
    }

    if (!code || !state) {
      res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:2rem;">
          <h2>❌ Invalid Callback</h2>
          <p>Missing <code>code</code> or <code>state</code> parameter.</p>
          <p>Please try <code>kroger_login</code> again.</p>
        </body></html>
      `);
      return;
    }

    try {
      await userAuth.handleCallback(code, state);
      res.send(`
        <html><body style="font-family:sans-serif;padding:2rem;max-width:480px;margin:auto;">
          <h2>✅ Logged in to Kroger!</h2>
          <p>Your session is ready. You can close this tab and return to Claude.</p>
          <p>You can now use:</p>
          <ul>
            <li><code>kroger_get_profile</code> — view your account</li>
            <li><code>kroger_add_to_cart</code> — add items to your cart</li>
            <li><code>kroger_logout</code> — end your session</li>
          </ul>
        </body></html>
      `);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:2rem;">
          <h2>❌ Authentication Error</h2>
          <p>${msg}</p>
          <p>Please try <code>kroger_login</code> again.</p>
        </body></html>
      `);
    }
  });

  authApp.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "kroger-mcp-server",
      version: "2.0.0",
      loggedIn: userAuth.isLoggedIn(),
    });
  });

  authApp.listen(authPort, () => {
    console.error(
      `🔐 OAuth callback server ready at http://localhost:${authPort}/auth/callback`
    );
  });
}

// ── MCP Transports ────────────────────────────────────────────────────────────

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🛒 kroger-mcp-server running via stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(port, () => {
    console.error(`🛒 kroger-mcp-server (MCP) running at http://localhost:${port}/mcp`);
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

startAuthCallbackServer();

const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
  runHTTP().catch((err: unknown) => {
    console.error("Server error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}
