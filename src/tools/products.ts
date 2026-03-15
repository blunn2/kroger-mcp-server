import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KrogerApiClient } from "../services/kroger-client.js";
import {
  SearchProductsSchema,
  GetProductSchema,
  type SearchProductsInput,
  type GetProductInput,
} from "../schemas/index.js";
import {
  formatProductsListMarkdown,
  formatProductMarkdown,
} from "../services/formatters.js";
import type { ProductsResponse, ProductResponse } from "../types.js";

export function registerProductTools(
  server: McpServer,
  client: KrogerApiClient
): void {
  // ── kroger_search_products ─────────────────────────────────────────────────

  server.registerTool(
    "kroger_search_products",
    {
      title: "Search Kroger Products",
      description: `Search Kroger's product catalog by keyword, brand, or fulfillment method.

Returns a paginated list of matching products including descriptions, pricing, inventory stock levels, sizes, and fulfillment options (in-store, curbside, delivery, ship-to-home).

⚠️ Prices and inventory are location-specific. Always provide a \`location_id\` (from kroger_search_locations) for accurate, real-world pricing and stock data.

Args:
  - term (string): Search keyword (e.g., "organic milk", "frozen pizza")
  - location_id (string, optional): Kroger store locationId for pricing/inventory
  - brand (string, optional): Filter by brand name
  - fulfillment ('ais'|'csp'|'dth'|'sth', optional): Filter by fulfillment method
  - limit (1–50, default 10): Number of results per page
  - start (default 0): Pagination offset
  - response_format ('markdown'|'json', default 'markdown'): Output format

Returns (JSON):
{
  "data": [
    {
      "productId": string,
      "description": string,
      "brand": string,
      "upc": string,
      "categories": string[],
      "items": [{ "itemId": string, "size": string, "price": { "regular": number, "promo": number }, "inventory": { "stockLevel": string } }]
    }
  ],
  "meta": { "pagination": { "start": number, "limit": number, "total": number } }
}

Examples:
  - "Find organic milk near zip 98402" → search_locations first, then search_products(term="organic milk", location_id=...)
  - "Show me Private Selection pasta" → term="pasta", brand="Private Selection"
  - "What frozen items can I get delivered?" → term="frozen", fulfillment="dth"

Error Handling:
  - Returns actionable error if credentials are invalid (check KROGER_CLIENT_ID / KROGER_CLIENT_SECRET)
  - Returns empty results message if no products match the search term`,
      inputSchema: SearchProductsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: SearchProductsInput) => {
      try {
        const query: Record<string, unknown> = {
          "filter.term": params.term,
          "filter.limit": params.limit,
          "filter.start": params.start,
        };

        if (params.location_id) query["filter.locationId"] = params.location_id;
        if (params.brand) query["filter.brand"] = params.brand;
        if (params.fulfillment) query["filter.fulfillment"] = params.fulfillment;

        const data = await client.request<ProductsResponse>(
          "GET",
          "/products",
          query
        );

        if (params.response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
          };
        }

        const text = formatProductsListMarkdown(data.data, data.meta);
        return { content: [{ type: "text", text }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error searching products: ${msg}` }],
        };
      }
    }
  );

  // ── kroger_get_product ────────────────────────────────────────────────────

  server.registerTool(
    "kroger_get_product",
    {
      title: "Get Kroger Product by ID",
      description: `Retrieve detailed information for a single Kroger product by its productId.

Returns full product details including all item variants (sizes/quantities), images, pricing at a specific location, aisle location, temperature requirements, and country of origin.

Use kroger_search_products first to discover productIds, then use this tool to get complete details.

Args:
  - product_id (string): Kroger productId (e.g., "0001111041700")
  - location_id (string, optional): LocationId for location-specific pricing/inventory
  - response_format ('markdown'|'json', default 'markdown'): Output format

Returns (JSON):
{
  "data": {
    "productId": string,
    "description": string,
    "brand": string,
    "upc": string,
    "categories": string[],
    "images": [{ "perspective": string, "sizes": [{ "size": string, "url": string }] }],
    "items": [...],
    "temperature": { "indicator": string, "heatSensitive": boolean },
    "aisleLocations": [{ "description": string, "number": string }]
  }
}

Examples:
  - After finding a product in search results: get_product(product_id="0001111041700", location_id="01400943")
  - To get product images: use response_format="json" and inspect the "images" field

Error Handling:
  - Returns 404 error if productId does not exist`,
      inputSchema: GetProductSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetProductInput) => {
      try {
        const query: Record<string, unknown> = {};
        if (params.location_id) query["filter.locationId"] = params.location_id;

        const data = await client.request<ProductResponse>(
          "GET",
          `/products/${params.product_id}`,
          Object.keys(query).length > 0 ? query : undefined
        );

        if (params.response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
          };
        }

        const text = formatProductMarkdown(data.data);
        return { content: [{ type: "text", text }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error fetching product "${params.product_id}": ${msg}`,
            },
          ],
        };
      }
    }
  );
}
