// src/lib/httpClient.ts
// Simple HTTP client for n8n webhook calls

import http from "http";
import https from "https";
import { URL } from "url";

export interface HttpClientOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Make an HTTP POST request with JSON body
 * Returns a promise that resolves when the request completes
 */
export function postJson(
  url: string,
  body: any,
  options?: HttpClientOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = Buffer.from(JSON.stringify(body), "utf-8");
    const isHttps = parsed.protocol === "https:";
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options?.method || "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length.toString(),
        ...options?.headers,
      },
      timeout: options?.timeout || 10000, // 10 second default timeout
    };

    const req = client.request(requestOptions, (res) => {
      // Consume response body (we don't need it, but must read it)
      res.on("data", () => {});
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${res.statusMessage || "Request failed"}`
            )
          );
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Make a generic HTTP request
 */
export function request(
  url: string,
  options?: HttpClientOptions
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options?.method || "GET",
      headers: options?.headers || {},
      timeout: options?.timeout || 10000,
    };

    const req = client.request(requestOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk.toString();
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 500,
          body,
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

