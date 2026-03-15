import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KrogerApiClient } from "../services/kroger-client.js";
import {
  SearchLocationsSchema,
  GetLocationSchema,
  type SearchLocationsInput,
  type GetLocationInput,
} from "../schemas/index.js";
import {
  formatLocationsListMarkdown,
  formatLocationMarkdown,
} from "../services/formatters.js";
import type { LocationsResponse, LocationResponse } from "../types.js";

export function registerLocationTools(
  server: McpServer,
  client: KrogerApiClient
): void {
  // ── kroger_search_locations ────────────────────────────────────────────────

  server.registerTool(
    "kroger_search_locations",
    {
      title: "Search Kroger Store Locations",
      description: `Find Kroger family store locations near a zip code or geographic coordinate.

Kroger operates many banners including Kroger, Fred Meyer, Ralphs, King Soopers, QFC, Fry's, Smith's, Dillons, Mariano's, and Pick 'n Save, among others.

Results include store name, address, phone number, coordinates, store hours, and available departments (Pharmacy, Bakery, Floral, Fuel Center, etc.).

⚡ Use the returned \`locationId\` with kroger_search_products for location-specific pricing and inventory.

Args:
  - zip_code (string): 5-digit US zip code — OR —
  - lat_lng (string): "latitude,longitude" (e.g., "47.2529,-122.4443" for Tacoma, WA)
  - radius_miles (1–100, default 10): Search radius in miles
  - chain (string, optional): Filter by banner name (e.g., "Fred Meyer", "Kroger", "QFC")
  - department (string, optional): Only return stores with this department (e.g., "Pharmacy")
  - limit (1–50, default 10): Number of results
  - start (default 0): Pagination offset
  - response_format ('markdown'|'json', default 'markdown'): Output format

Returns (JSON):
{
  "data": [
    {
      "locationId": string,        // Use this with kroger_search_products!
      "name": string,
      "chain": string,
      "storeNumber": string,
      "address": { "addressLine1": string, "city": string, "state": string, "zipCode": string },
      "geolocation": { "latitude": number, "longitude": number },
      "phone": string,
      "hours": [{ "day": string, "open": string, "close": string, "open24": boolean }],
      "departments": [{ "name": string, "phone": string }]
    }
  ]
}

Examples:
  - "Find Kroger stores near me" (Tacoma) → zip_code="98402"
  - "Find Fred Meyer stores within 5 miles of Seattle" → lat_lng="47.6062,-122.3321", chain="Fred Meyer", radius_miles=5
  - "Which stores near 90210 have a Pharmacy?" → zip_code="90210", department="Pharmacy"

Error Handling:
  - If no results, try increasing radius_miles or removing filters
  - Returns error if neither zip_code nor lat_lng is provided`,
      inputSchema: SearchLocationsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: SearchLocationsInput) => {
      try {
        if (!params.zip_code && !params.lat_lng) {
          return {
            isError: true,
            content: [{ type: "text", text: "Error: Provide either 'zip_code' or 'lat_lng' to search for locations." }],
          };
        }

        const query: Record<string, unknown> = {
          "filter.radiusInMiles": params.radius_miles,
          "filter.limit": params.limit,
          "filter.start": params.start,
        };

        if (params.zip_code) query["filter.zipCode.near"] = params.zip_code;
        if (params.lat_lng) query["filter.latLng.near"] = params.lat_lng;
        if (params.chain) query["filter.chain"] = params.chain;
        if (params.department) query["filter.department"] = params.department;

        const data = await client.request<LocationsResponse>(
          "GET",
          "/locations",
          query
        );

        if (params.response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
          };
        }

        const text = formatLocationsListMarkdown(data.data, data.meta);
        return { content: [{ type: "text", text }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error searching locations: ${msg}. Try adjusting your zip_code, lat_lng, or radius_miles.`,
            },
          ],
        };
      }
    }
  );

  // ── kroger_get_location ───────────────────────────────────────────────────

  server.registerTool(
    "kroger_get_location",
    {
      title: "Get Kroger Store Location by ID",
      description: `Retrieve full details for a specific Kroger family store by its locationId.

Returns complete store information including all departments with their individual hours and phone numbers, full address, geolocation, and store hours.

Use kroger_search_locations first to discover locationIds.

Args:
  - location_id (string): Kroger locationId (e.g., "01400943")
  - response_format ('markdown'|'json', default 'markdown'): Output format

Returns (JSON):
{
  "data": {
    "locationId": string,
    "name": string,
    "chain": string,
    "storeNumber": string,
    "address": { ... },
    "geolocation": { "latitude": number, "longitude": number, "latLng": string },
    "phone": string,
    "hours": [...],
    "departments": [
      { "departmentId": string, "name": string, "phone": string, "hours": [...] }
    ]
  }
}

Examples:
  - After finding a store: get_location(location_id="01400943")
  - To check pharmacy hours: get_location(...) then inspect departments

Error Handling:
  - Returns 404 if locationId is invalid`,
      inputSchema: GetLocationSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetLocationInput) => {
      try {
        const data = await client.request<LocationResponse>(
          "GET",
          `/locations/${params.location_id}`
        );

        if (params.response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            structuredContent: data,
          };
        }

        const text = formatLocationMarkdown(data.data);
        return { content: [{ type: "text", text }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error fetching location "${params.location_id}": ${msg}`,
            },
          ],
        };
      }
    }
  );
}
