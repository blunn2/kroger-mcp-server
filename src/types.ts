// ────────────────────────────────────────────────────────────────────────────
// Kroger API – Shared TypeScript Types
// ────────────────────────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface KrogerTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

// ── User Auth ─────────────────────────────────────────────────────────────────

export interface UserTokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms timestamp
  scope: string;
}

// ── User Profile ──────────────────────────────────────────────────────────────

export interface UserAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  country?: string;
}

export interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  homeStore?: {
    locationId: string;
    storeNumber?: string;
    divisionNumber?: string;
  };
}

export interface ProfileResponse {
  data: UserProfile;
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  upc: string;
  quantity: number;
  modality?: "PICKUP" | "DELIVERY" | "SHIP";
}

export interface CartResponse {
  data?: unknown;
}

// ── Products ─────────────────────────────────────────────────────────────────

export interface ProductImage {
  id: string;
  perspective: string;
  default?: boolean;
  sizes: Array<{
    id: string;
    size: string;
    url: string;
  }>;
}

export interface ProductItem {
  itemId: string;
  inventory?: { stockLevel: string };
  fulfillment?: {
    curbside?: boolean;
    delivery?: boolean;
    inStore?: boolean;
    shipToHome?: boolean;
  };
  price?: {
    regular: number;
    promo: number;
  };
  size?: string;
  soldBy?: string;
  nationalPrice?: {
    regular: number;
    promo: number;
  };
}

export interface Product {
  productId: string;
  aisleLocations?: Array<{ bayNumber: string; description: string; number: string; side: string }>;
  brand?: string;
  categories?: string[];
  countryOrigin?: string;
  description: string;
  images?: ProductImage[];
  items?: ProductItem[];
  itemInformation?: {
    depth?: string;
    height?: string;
    width?: string;
  };
  temperature?: {
    indicator: string;
    heatSensitive: boolean;
  };
  upc?: string;
}

export interface ProductsResponse {
  data: Product[];
  meta?: {
    pagination?: {
      start: number;
      limit: number;
      total: number;
    };
    warnings?: string[];
  };
}

export interface ProductResponse {
  data: Product;
}

// ── Locations ────────────────────────────────────────────────────────────────

export interface LocationAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
}

export interface LocationHours {
  timezone?: string;
  open24?: boolean;
  monday?: { open: string; close: string; open24: boolean };
  tuesday?: { open: string; close: string; open24: boolean };
  wednesday?: { open: string; close: string; open24: boolean };
  thursday?: { open: string; close: string; open24: boolean };
  friday?: { open: string; close: string; open24: boolean };
  saturday?: { open: string; close: string; open24: boolean };
  sunday?: { open: string; close: string; open24: boolean };
}

export interface LocationDepartment {
  departmentId: string;
  name: string;
  phone?: string;
  hours?: LocationHours;
}

export interface Location {
  locationId: string;
  chain?: string;
  name: string;
  storeNumber?: string;
  divisionNumber?: string;
  address: LocationAddress;
  geolocation?: {
    latitude: number;
    longitude: number;
    latLng: string;
  };
  hours?: LocationHours;
  departments?: LocationDepartment[];
  phone?: string;
}

export interface LocationsResponse {
  data: Location[];
  meta?: {
    pagination?: {
      start: number;
      limit: number;
      total: number;
    };
    warnings?: string[];
  };
}

export interface LocationResponse {
  data: Location;
}
