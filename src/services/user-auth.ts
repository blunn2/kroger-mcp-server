import axios from "axios";
import crypto from "crypto";
import {
  KROGER_TOKEN_URL,
  KROGER_AUTH_URL,
  USER_SCOPES,
  DEFAULT_REDIRECT_URI,
} from "../constants.js";
import type { KrogerTokenResponse } from "../types.js";

interface UserTokenCache {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/**
 * Manages the OAuth 2.0 Authorization Code flow for user-authenticated requests.
 *
 * Flow:
 *   1. generateAuthUrl()  → return URL for user to open in browser
 *   2. User logs in at Kroger, browser redirects to /auth/callback?code=xxx
 *   3. handleCallback(code) → exchanges code for access + refresh tokens
 *   4. getUserToken()      → returns valid access token (auto-refreshes if needed)
 */
export class UserAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  private userToken: UserTokenCache | null = null;
  private pendingState: string | null = null;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri =
      process.env.KROGER_REDIRECT_URI ?? DEFAULT_REDIRECT_URI;
  }

  // ── Step 1: Generate auth URL ─────────────────────────────────────────────

  generateAuthUrl(): { url: string; state: string } {
    const state = crypto.randomBytes(16).toString("hex");
    this.pendingState = state;

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: USER_SCOPES,
      state,
    });

    return {
      url: `${KROGER_AUTH_URL}?${params.toString()}`,
      state,
    };
  }

  // ── Step 2: Exchange code for tokens ──────────────────────────────────────

  async handleCallback(code: string, state: string): Promise<void> {
    if (state !== this.pendingState) {
      throw new Error(
        "OAuth state mismatch — possible CSRF attack. Please try logging in again."
      );
    }
    this.pendingState = null;

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    const res = await axios.post<KrogerTokenResponse>(
      KROGER_TOKEN_URL,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const now = Date.now();
    this.userToken = {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresAt: now + res.data.expires_in * 1000,
    };
  }

  // ── Step 3: Get a valid user access token (auto-refresh) ──────────────────

  async getUserToken(): Promise<string> {
    if (!this.userToken) {
      throw new Error(
        "Not logged in. Use the kroger_login tool to authenticate with your Kroger account first."
      );
    }

    const now = Date.now();

    // Token still valid
    if (this.userToken.expiresAt > now + 30_000) {
      return this.userToken.accessToken;
    }

    // Attempt refresh
    if (this.userToken.refreshToken) {
      try {
        const credentials = Buffer.from(
          `${this.clientId}:${this.clientSecret}`
        ).toString("base64");

        const res = await axios.post<KrogerTokenResponse>(
          KROGER_TOKEN_URL,
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: this.userToken.refreshToken,
          }).toString(),
          {
            headers: {
              Authorization: `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        this.userToken = {
          accessToken: res.data.access_token,
          refreshToken: res.data.refresh_token ?? this.userToken.refreshToken,
          expiresAt: now + res.data.expires_in * 1000,
        };

        return this.userToken.accessToken;
      } catch {
        this.userToken = null;
        throw new Error(
          "Session expired and refresh failed. Use kroger_login to log in again."
        );
      }
    }

    this.userToken = null;
    throw new Error(
      "Session expired. Use kroger_login to log in again."
    );
  }

  isLoggedIn(): boolean {
    return this.userToken !== null;
  }

  logout(): void {
    this.userToken = null;
    this.pendingState = null;
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }
}
