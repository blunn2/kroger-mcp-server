export const KROGER_API_BASE = "https://api.kroger.com/v1";
export const KROGER_TOKEN_URL = `${KROGER_API_BASE}/connect/oauth2/token`;
export const KROGER_AUTH_URL = `${KROGER_API_BASE}/connect/oauth2/authorize`;

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
export const CHARACTER_LIMIT = 8000;

/** Scopes needed for public (non-user) data */
export const PUBLIC_SCOPE = "product.compact";

/** Scopes needed for user account access */
export const USER_SCOPES = "product.compact cart.basic:write profile.compact";

/** Default redirect URI — must match what's registered in the Kroger dev portal */
export const DEFAULT_REDIRECT_URI = "http://localhost:3001/auth/callback";
