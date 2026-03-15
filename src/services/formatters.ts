import { CHARACTER_LIMIT } from "../constants.js";
import type { Product, Location, LocationHours } from "../types.js";

// ── Truncation ────────────────────────────────────────────────────────────────

export function truncate(text: string, limit = CHARACTER_LIMIT): string {
  if (text.length <= limit) return text;
  return (
    text.slice(0, limit) +
    `\n\n[...truncated — ${text.length - limit} characters omitted. Use pagination to retrieve more results.]`
  );
}

// ── Product formatters ────────────────────────────────────────────────────────

export function formatProductMarkdown(p: Product): string {
  const price = p.items?.[0]?.price;
  const priceStr = price
    ? `$${price.regular.toFixed(2)}${price.promo ? ` (promo: $${price.promo.toFixed(2)})` : ""}`
    : "Price unavailable";

  const stock = p.items?.[0]?.inventory?.stockLevel ?? "Unknown";
  const size = p.items?.[0]?.size ?? "";
  const categories = p.categories?.join(", ") ?? "";
  const fulfillment = p.items?.[0]?.fulfillment;
  const fulfillmentOptions = fulfillment
    ? Object.entries(fulfillment)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ")
    : "";

  return [
    `### ${p.description}`,
    `- **ID**: \`${p.productId}\``,
    p.brand ? `- **Brand**: ${p.brand}` : null,
    p.upc ? `- **UPC**: ${p.upc}` : null,
    size ? `- **Size**: ${size}` : null,
    `- **Price**: ${priceStr}`,
    `- **Stock Level**: ${stock}`,
    categories ? `- **Categories**: ${categories}` : null,
    fulfillmentOptions ? `- **Fulfillment Options**: ${fulfillmentOptions}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatProductsListMarkdown(
  products: Product[],
  meta?: { pagination?: { start: number; limit: number; total: number } }
): string {
  if (!products.length) return "No products found.";

  const header =
    meta?.pagination
      ? `Found **${meta.pagination.total}** products (showing ${meta.pagination.start + 1}–${meta.pagination.start + products.length}):\n\n`
      : `Found **${products.length}** product(s):\n\n`;

  const items = products.map(formatProductMarkdown).join("\n\n---\n\n");
  return truncate(header + items);
}

// ── Location formatters ───────────────────────────────────────────────────────

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

export function formatHours(hours: Record<string, unknown> | undefined): string {
  if (!hours) return "Hours not available";
  return DAYS
    .filter((day) => hours[day])
    .map((day) => {
      const h = hours[day] as { open: string; close: string; open24: boolean };
      return `  ${day.charAt(0).toUpperCase() + day.slice(1)}: ${h.open24 ? "Open 24h" : `${h.open} – ${h.close}`}`;
    })
    .join("\n");
}

export function formatLocationMarkdown(loc: Location): string {
  const addr = loc.address;
  const addressStr = [
    addr.addressLine1,
    addr.addressLine2,
    `${addr.city}, ${addr.state} ${addr.zipCode}`,
  ]
    .filter(Boolean)
    .join(", ");

  const geo = loc.geolocation
    ? `${loc.geolocation.latitude.toFixed(5)}, ${loc.geolocation.longitude.toFixed(5)}`
    : null;

  const departments =
    loc.departments && loc.departments.length > 0
      ? loc.departments.map((d) => d.name).join(", ")
      : null;

  return [
    `### ${loc.name}`,
    `- **Location ID**: \`${loc.locationId}\``,
    loc.chain ? `- **Chain**: ${loc.chain}` : null,
    loc.storeNumber ? `- **Store #**: ${loc.storeNumber}` : null,
    `- **Address**: ${addressStr}`,
    geo ? `- **Coordinates**: ${geo}` : null,
    loc.phone ? `- **Phone**: ${loc.phone}` : null,
    departments ? `- **Departments**: ${departments}` : null,
    loc.hours ? `- **Hours**:\n${formatHours(loc.hours)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatLocationsListMarkdown(
  locations: Location[],
  meta?: { pagination?: { start: number; limit: number; total: number } }
): string {
  if (!locations.length) return "No locations found.";

  const header =
    meta?.pagination
      ? `Found **${meta.pagination.total}** locations (showing ${meta.pagination.start + 1}–${meta.pagination.start + locations.length}):\n\n`
      : `Found **${locations.length}** location(s):\n\n`;

  const items = locations.map(formatLocationMarkdown).join("\n\n---\n\n");
  return truncate(header + items);
}
