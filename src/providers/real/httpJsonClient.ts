import type { ProviderCredentialConfig } from "../../config/types.js";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

type QueryValue = string | number | boolean | undefined;

export interface HttpJsonClientOptions {
  providerName: string;
  baseUrl: string;
  credential: ProviderCredentialConfig;
  defaultHeaders?: Record<string, string>;
  disableTlsValidation?: boolean;
}

export class HttpJsonClient {
  private readonly providerName: string;
  private readonly baseUrl: string;
  private readonly credential: ProviderCredentialConfig;
  private readonly defaultHeaders: Record<string, string>;
  private readonly httpsAgent: https.Agent | undefined;

  constructor(options: HttpJsonClientOptions) {
    this.providerName = options.providerName;
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.credential = options.credential;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.httpsAgent = options.disableTlsValidation ? new https.Agent({ rejectUnauthorized: false }) : undefined;
  }

  async requestJson<T>(
    path: string,
    options?: {
      method?: "GET" | "POST";
      query?: Record<string, QueryValue>;
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Promise<T> {
    const method = options?.method ?? "GET";
    const url = buildUrl(this.baseUrl, path, options?.query);
    const authorization = resolveAuthorizationHeader(this.credential);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.defaultHeaders,
      ...(authorization ? { Authorization: authorization } : {}),
      ...(options?.headers ?? {})
    };

    let body: string | undefined;
    if (typeof options?.body !== "undefined") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const response = await sendHttpRequest(url, {
      method,
      headers,
      body,
      httpsAgent: this.httpsAgent
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const errorText = response.bodyText.trim().slice(0, 500);
      throw new Error(
        `${this.providerName} request failed: ${response.statusCode} ${response.statusMessage} (${url})${
          errorText ? ` - ${errorText}` : ""
        }`
      );
    }

    if (response.statusCode === 204) {
      return undefined as T;
    }

    const text = response.bodyText;
    if (!text.trim()) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }
}

function resolveAuthorizationHeader(credential: ProviderCredentialConfig): string | undefined {
  const token = resolveCredentialValue(credential.token, credential.tokenRef);
  if (!token) {
    return undefined;
  }
  return `Bearer ${token}`;
}

function resolveCredentialValue(direct: string | undefined, reference: string | undefined): string | undefined {
  if (direct && direct.trim()) {
    return direct.trim();
  }
  if (!reference) {
    return undefined;
  }
  const ref = reference.trim();
  return ref || undefined;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const raw = /^https?:\/\//.test(path)
    ? new URL(path)
    : new URL(path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "undefined") {
        continue;
      }
      raw.searchParams.set(key, String(value));
    }
  }
  return raw.toString();
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

async function sendHttpRequest(
  url: string,
  options: {
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
    httpsAgent?: https.Agent;
  }
): Promise<{ statusCode: number; statusMessage: string; bodyText: string }> {
  const target = new URL(url);
  const isHttps = target.protocol === "https:";
  const transport = isHttps ? https : http;

  return await new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method: options.method,
        headers: options.headers,
        ...(isHttps && options.httpsAgent ? { agent: options.httpsAgent } : {})
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf8");
          resolve({
            statusCode: response.statusCode ?? 0,
            statusMessage: response.statusMessage ?? "",
            bodyText
          });
        });
      }
    );

    request.on("error", reject);

    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}
