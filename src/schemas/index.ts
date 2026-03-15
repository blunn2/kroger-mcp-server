import { z } from "zod";

// ── Shared ────────────────────────────────────────────────────────────────────

export const ResponseFormatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format: 'markdown' for human-readable, 'json' for machine-readable structured data");

// ── Products ─────────────────────────────────────────────────────────────────

export const SearchProductsSchema = z
  .object({
    term: z
      .string()
      .min(1)
      .max(200)
      .describe("Search term to find products (e.g., 'organic milk', 'frozen pizza', 'bread')"),
    location_id: z
      .string()
      .optional()
      .describe(
        "Kroger locationId to get location-specific pricing/inventory (use kroger_search_locations to find one). Highly recommended for accurate results."
      ),
    brand: z.string().optional().describe("Filter by brand name (e.g., 'Private Selection')"),
    fulfillment: z
      .enum(["ais", "csp", "dth", "sth"])
      .optional()
      .describe(
        "Filter by fulfillment method: 'ais'=in-store, 'csp'=curbside pickup, 'dth'=delivery to home, 'sth'=ship to home"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of products to return (1–50, default: 10)"),
    start: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Pagination offset — number of results to skip (default: 0)"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export const GetProductSchema = z
  .object({
    product_id: z
      .string()
      .min(1)
      .describe("Kroger productId to retrieve (e.g., '0001111041700')"),
    location_id: z
      .string()
      .optional()
      .describe(
        "Kroger locationId for location-specific pricing and inventory. Recommended."
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();

// ── Locations ────────────────────────────────────────────────────────────────

export const SearchLocationsSchema = z
  .object({
    zip_code: z
      .string()
      .regex(/^\d{5}$/, "Must be a 5-digit US zip code")
      .optional()
      .describe("5-digit US zip code to search near (e.g., '98402' for Tacoma, WA)"),
    lat_lng: z
      .string()
      .optional()
      .describe(
        "Latitude and longitude to search near, as 'lat,lng' (e.g., '47.2529,-122.4443'). Use instead of zip_code for precise location."
      ),
    radius_miles: z
      .number()
      .min(1)
      .max(100)
      .default(10)
      .describe("Search radius in miles (1–100, default: 10)"),
    chain: z
      .string()
      .optional()
      .describe(
        "Filter by Kroger banner/chain name (e.g., 'Kroger', 'Fred Meyer', 'Ralphs', 'King Soopers', 'QFC', 'Fry\\'s', 'Smith\\'s', 'Dillons', 'Mariano\\'s', 'Pick \\'n Save')"
      ),
    department: z
      .string()
      .optional()
      .describe("Filter locations that have this department (e.g., 'Pharmacy', 'Floral', 'Bakery')"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of locations to return (1–50, default: 10)"),
    start: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Pagination offset (default: 0)"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export const GetLocationSchema = z
  .object({
    location_id: z
      .string()
      .min(1)
      .describe("Kroger locationId to retrieve (e.g., '01400943')"),
    response_format: ResponseFormatSchema,
  })
  .strict();

// ── Type exports ─────────────────────────────────────────────────────────────

export type SearchProductsInput = z.infer<typeof SearchProductsSchema>;
export type GetProductInput = z.infer<typeof GetProductSchema>;
export type SearchLocationsInput = z.infer<typeof SearchLocationsSchema>;
export type GetLocationInput = z.infer<typeof GetLocationSchema>;
