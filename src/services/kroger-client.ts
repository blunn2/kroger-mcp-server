import axios, { AxiosInstance, AxiosError } from "axios";
import { KROGER_API_BASE, KROGER_TOKEN_URL, PUBLIC_SCOPE } from "../constants.js";
import type { KrogerTokenResponse } from "../types.js";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // ms timestamp
}

export class KrogerApiClient {
  private readonly http: AxiosInstance;
  private tokenCache: TokenCache | null = null;

  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    this.http = axios.create({
      baseURL: KROGER_API_BASE,
      timeout: 15_000,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Token management ───────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.accessToken;
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");

    const res = await axios.post<KrogerTokenResponse>(
      KROGER_TOKEN_URL,
      `grant_type=client_credentials&scope=${encodeURIComponent(PUBLIC_SCOPE)}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    this.tokenCache = {
      accessToken: res.data.access_token,
      expiresAt: now + res.data.expires_in * 1000,
    };

    return this.tokenCache.accessToken;
  }

  // ── Generic request helper ─────────────────────────────────────────────────

  async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    params?: Record<string, unknown>,
    body?: unknown
  ): Promise<T> {
    const token = await this.getAccessToken();

    try {
      const res = await this.http.request<T>({
        method,
        url: path,
        headers: { Authorization: `Bearer ${token}` },
        params,
        data: body,
      });
      return res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const ae = err as AxiosError<{ message?: string; errors?: unknown[] }>;
        const status = ae.response?.status ?? 0;
        const msg =
          ae.response?.data?.message ??
          ae.message ??
          "Unknown Kroger API error";

        if (status === 401) {
          // Clear cache so next call re-authenticates
          this.tokenCache = null;
          throw new Error(
            `Kroger API – authentication failed (401). Check your KROGER_CLIENT_ID and KROGER_CLIENT_SECRET.`
          );
        }
        if (status === 400) {
          throw new Error(
            `Kroger API – bad request (400): ${msg}. Verify your query parameters.`
          );
        }
        if (status === 404) {
          throw new Error(
            `Kroger API – resource not found (404): ${msg}.`
          );
        }
        if (status === 429) {
          throw new Error(
            `Kroger API – rate limit exceeded (429). Please wait before retrying.`
          );
        }
        throw new Error(`Kroger API – HTTP ${status}: ${msg}`);
      }
      throw err;
    }
  }
}
