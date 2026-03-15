import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import { z } from "zod";
import type { UserAuthService } from "../services/user-auth.js";
import type { ProfileResponse, CartItem } from "../types.js";
import { KROGER_API_BASE } from "../constants.js";

// ── Schemas ───────────────────────────────────────────────────────────────────

const LoginSchema = z.object({}).strict();

const GetProfileSchema = z
  .object({
    response_format: z
      .enum(["markdown", "json"])
      .default("markdown")
      .describe("Output format: 'markdown' for human-readable, 'json' for structured data"),
  })
  .strict();

const AddToCartSchema = z
  .object({
    items: z
      .array(
        z.object({
          upc: z
            .string()
            .min(1)
            .describe("Product UPC code (from kroger_search_products or kroger_get_product)"),
          quantity: z
            .number()
            .int()
            .min(1)
            .max(99)
            .describe("Quantity to add (1–99)"),
          modality: z
            .enum(["PICKUP", "DELIVERY", "SHIP"])
            .default("PICKUP")
            .describe("Fulfillment method: PICKUP, DELIVERY, or SHIP"),
        })
      )
      .min(1)
      .max(50)
      .describe("List of items to add to cart (up to 50 at once)"),
  })
  .strict();

const LogoutSchema = z.object({}).strict();

type GetProfileInput = z.infer<typeof GetProfileSchema>;
type AddToCartInput = z.infer<typeof AddToCartSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function userRequest<T>(
  token: string,
  method: "GET" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await axios.request<T>({
    method,
    url: `${KROGER_API_BASE}${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: body,
    timeout: 15_000,
  });
  return res.data;
}

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerUserTools(
  server: McpServer,
  userAuth: UserAuthService
): void {
  // ── kroger_login ──────────────────────────────────────────────────────────

  server.registerTool(
    "kroger_login",
    {
      title: "Login to Kroger Account",
      description: `Start the Kroger account login flow to enable user-specific features.

Returns a URL for the user to open in their browser. After they log in and approve access, the server automatically captures the session — no further action needed.

Required before using:
  - kroger_get_profile (view account info)
  - kroger_add_to_cart (add items to your cart)
  - kroger_logout (end your session)

This uses OAuth 2.0 Authorization Code flow. Your Kroger credentials are entered directly on Kroger's website — they are never seen by this server.

Returns:
  A login URL to open in your browser. Once you complete login, come back and use the other user tools.

Examples:
  - "Log me into my Kroger account" → kroger_login()
  - Always call this first before kroger_add_to_cart`,
      inputSchema: LoginSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const { url } = userAuth.generateAuthUrl();

        return {
          content: [
            {
              type: "text",
              text: [
                "## Kroger Login",
                "",
                "Open this URL in your browser to log into your Kroger account:",
                "",
                `**${url}**`,
                "",
                "After you approve access on Kroger's website, you'll be redirected back and your session will be ready automatically.",
                "",
                `_(Redirect target: ${userAuth.getRedirectUri()})_`,
              ].join("\n"),
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error generating login URL: ${msg}` }],
        };
      }
    }
  );

  // ── kroger_get_profile ────────────────────────────────────────────────────

  server.registerTool(
    "kroger_get_profile",
    {
      title: "Get My Kroger Profile",
      description: `Retrieve your Kroger account profile including name, email, and home store.

⚠️ Requires login first — call kroger_login if you haven't authenticated yet.

Args:
  - response_format ('markdown'|'json', default 'markdown'): Output format

Returns (JSON):
{
  "data": {
    "id": string,
    "firstName": string,
    "lastName": string,
    "email": string,
    "phone": string,
    "homeStore": { "locationId": string }
  }
}

Examples:
  - "What's my Kroger account email?" → kroger_get_profile()
  - "What's my home store?" → kroger_get_profile(), then use homeStore.locationId with kroger_get_location`,
      inputSchema: GetProfileSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetProfileInput) => {
      try {
        const token = await userAuth.getUserToken();
        const data = await userRequest<ProfileResponse>(token, "GET", "/identity/profile");

        if (params.response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
          };
        }

        const p = data.data;
        const lines = [
          "## Your Kroger Profile",
          "",
          p.firstName || p.lastName
            ? `- **Name**: ${[p.firstName, p.lastName].filter(Boolean).join(" ")}`
            : null,
          p.email ? `- **Email**: ${p.email}` : null,
          p.phone ? `- **Phone**: ${p.phone}` : null,
          p.id ? `- **Account ID**: ${p.id}` : null,
          p.homeStore?.locationId
            ? `- **Home Store ID**: \`${p.homeStore.locationId}\` _(use with kroger_get_location for details)_`
            : null,
        ].filter(Boolean);

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching profile: ${msg}` }],
        };
      }
    }
  );

  // ── kroger_add_to_cart ────────────────────────────────────────────────────

  server.registerTool(
    "kroger_add_to_cart",
    {
      title: "Add Items to Kroger Cart",
      description: `Add one or more products to your Kroger cart by UPC code.

⚠️ Requires login first — call kroger_login if you haven't authenticated yet.

To find UPC codes: use kroger_search_products or kroger_get_product and look for the "upc" field in the results.

Args:
  - items (array): List of items to add, each with:
    - upc (string): Product UPC (found in product search results)
    - quantity (1–99): How many to add
    - modality ('PICKUP'|'DELIVERY'|'SHIP', default 'PICKUP'): Fulfillment method

Returns:
  Confirmation message listing items added.

Examples:
  - "Add 2 gallons of milk to my cart" → first search for milk to get UPC, then add_to_cart(items=[{upc:"...", quantity:2}])
  - "Add items for delivery" → add_to_cart(items=[{upc:"...", quantity:1, modality:"DELIVERY"}])
  - "Add multiple items at once" → add_to_cart(items=[{upc:"001", quantity:1}, {upc:"002", quantity:3}])

Error Handling:
  - Returns login prompt if not authenticated
  - Returns error if UPC is invalid or item is unavailable`,
      inputSchema: AddToCartSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: AddToCartInput) => {
      try {
        const token = await userAuth.getUserToken();

        const cartItems: CartItem[] = params.items.map((item) => ({
          upc: item.upc,
          quantity: item.quantity,
          modality: item.modality,
        }));

        await userRequest(token, "PUT", "/cart/add", { items: cartItems });

        const summary = params.items
          .map((i) => `- ${i.quantity}× UPC \`${i.upc}\` (${i.modality ?? "PICKUP"})`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `## ✅ Added to Cart\n\n${summary}\n\nYour Kroger cart has been updated. Open the Kroger app or website to review your cart before checkout.`,
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error adding to cart: ${msg}` }],
        };
      }
    }
  );

  // ── kroger_logout ─────────────────────────────────────────────────────────

  server.registerTool(
    "kroger_logout",
    {
      title: "Logout from Kroger Account",
      description: `Clear your Kroger login session from this server.

After logging out, kroger_get_profile and kroger_add_to_cart will require you to log in again with kroger_login.

Note: This clears the token from this server only. It does not sign you out of the Kroger website or app.

Examples:
  - "Log me out of Kroger" → kroger_logout()`,
      inputSchema: LogoutSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      userAuth.logout();
      return {
        content: [
          {
            type: "text",
            text: "✅ Logged out. Your Kroger session has been cleared from this server.",
          },
        ],
      };
    }
  );
}
