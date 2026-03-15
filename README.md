# 🛒 kroger-mcp-server

An MCP (Model Context Protocol) server for the [Kroger Public API](https://developer.kroger.com/documentation/public/getting-started/apis). Enables LLMs to search Kroger's product catalog, find store locations, and look up pricing and inventory — across all Kroger family banners (Kroger, Fred Meyer, Ralphs, King Soopers, QFC, Fry's, Smith's, Dillons, Mariano's, Pick 'n Save, and more).

---

## 🚀 Quick Start

### 1. Get API Credentials

1. Register at [developer.kroger.com](https://developer.kroger.com/manage/apps/register)
2. Create a new app and note your **Client ID** and **Client Secret**
3. The free public tier gives access to the Products and Locations APIs

### 2. Install & Build

```bash
npm install
npm run build
```

### 3. Run

```bash
# stdio (for Claude Desktop / MCP clients)
KROGER_CLIENT_ID=your_id KROGER_CLIENT_SECRET=your_secret npm start

# HTTP server
TRANSPORT=http KROGER_CLIENT_ID=your_id KROGER_CLIENT_SECRET=your_secret npm start
```

---

## 🔧 Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kroger": {
      "command": "node",
      "args": ["/absolute/path/to/kroger-mcp-server/dist/index.js"],
      "env": {
        "KROGER_CLIENT_ID": "your_client_id_here",
        "KROGER_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

---

## 🛠️ Available Tools

### `kroger_search_products`
Search Kroger's catalog by keyword.

| Parameter | Type | Description |
|---|---|---|
| `term` | string | Search keyword (e.g., "organic milk") |
| `location_id` | string? | Store locationId for pricing/inventory |
| `brand` | string? | Filter by brand name |
| `fulfillment` | enum? | `ais` / `csp` / `dth` / `sth` |
| `limit` | number | 1–50, default 10 |
| `start` | number | Pagination offset |
| `response_format` | enum | `markdown` or `json` |

### `kroger_get_product`
Get full details for a product by ID.

| Parameter | Type | Description |
|---|---|---|
| `product_id` | string | Kroger productId |
| `location_id` | string? | Store locationId for pricing |
| `response_format` | enum | `markdown` or `json` |

### `kroger_search_locations`
Find Kroger family stores near a location.

| Parameter | Type | Description |
|---|---|---|
| `zip_code` | string? | 5-digit zip code |
| `lat_lng` | string? | `"lat,lng"` (use instead of zip) |
| `radius_miles` | number | 1–100, default 10 |
| `chain` | string? | Filter by banner (e.g., "Fred Meyer") |
| `department` | string? | Filter by department (e.g., "Pharmacy") |
| `limit` | number | 1–50, default 10 |
| `start` | number | Pagination offset |
| `response_format` | enum | `markdown` or `json` |

### `kroger_get_location`
Get full details for a store by locationId.

| Parameter | Type | Description |
|---|---|---|
| `location_id` | string | Kroger locationId |
| `response_format` | enum | `markdown` or `json` |

---

## 📖 Example Workflows

### Find products at your nearest store

```
1. kroger_search_locations(zip_code="98402", limit=1)
   → Returns locationId, e.g., "01400943"

2. kroger_search_products(term="organic chicken", location_id="01400943")
   → Returns products with local pricing + stock levels
```

### Find a store with specific amenities

```
kroger_search_locations(zip_code="90210", department="Pharmacy", chain="Ralphs")
```

### Compare product pricing

```
kroger_search_products(term="bread", location_id="...", limit=20, response_format="json")
→ Parse JSON for price comparison
```

---

## 🔐 Authentication

The server uses **OAuth 2.0 client credentials** flow automatically. Tokens are cached and refreshed transparently — no manual token management required.

Scopes used:
- `product.compact` — access to the public Products API

---

## 🏗️ Architecture

```
kroger-mcp-server/
├── src/
│   ├── index.ts              # Entry point, transport selection
│   ├── types.ts              # TypeScript interfaces for API responses
│   ├── constants.ts          # API URLs, defaults, limits
│   ├── schemas/
│   │   └── index.ts          # Zod input validation schemas
│   ├── services/
│   │   ├── kroger-client.ts  # Axios HTTP client with token caching
│   │   └── formatters.ts     # Markdown + JSON response formatters
│   └── tools/
│       ├── products.ts       # Product search + detail tools
│       └── locations.ts      # Location search + detail tools
└── dist/                     # Compiled JavaScript (after npm run build)
```

---

## 📝 Notes

- Pricing and inventory data are **location-specific** — always pass a `location_id` for accurate results
- The public API covers all Kroger banners: Kroger, Fred Meyer, Ralphs, King Soopers, QFC, Fry's, Smith's, Dillons, Mariano's, Pick 'n Save, Harris Teeter, and more
- Rate limits are enforced per endpoint by Kroger; the server returns clear error messages if limits are hit
- The Cart and Identity APIs (requiring user OAuth) are not included in this server as they require an interactive browser flow
