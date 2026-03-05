// src/lib/storage.ts
// S3-compatible storage (AWS S3 or Cloudflare R2) — one implementation for both.
// Set STORAGE_ENDPOINT for R2; leave empty for S3. No code changes, only env.

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export interface StorageConfig {
  provider: string;
  bucket: string;
  region: string;
  endpoint: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

let cachedConfig: StorageConfig | null = null;

/**
 * Get storage config from env. Throws if required vars are missing.
 * Call this only when a route that needs storage is hit (so app can start without STORAGE_* set).
 */
export function getStorageConfig(): StorageConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = {
    provider: process.env.STORAGE_PROVIDER || "s3",
    bucket: mustEnv("STORAGE_BUCKET"),
    region: process.env.STORAGE_REGION || "us-west-2",
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    accessKeyId: mustEnv("STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: mustEnv("STORAGE_SECRET_ACCESS_KEY"),
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || "",
  };
  return cachedConfig;
}

export function makeS3Client(): S3Client {
  const config = getStorageConfig();
  const isR2 = config.provider === "r2" || !!config.endpoint;

  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: isR2,
  });
}

export interface SignPutObjectParams {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface SignPutObjectResult {
  putUrl: string;
  publicUrl: string | undefined;
}

export async function signPutObject(params: SignPutObjectParams): Promise<SignPutObjectResult> {
  const config = getStorageConfig();
  const s3 = makeS3Client();
  const cmd = new PutObjectCommand({
    Bucket: config.bucket,
    Key: params.key,
    ContentType: params.contentType,
  });

  const putUrl = await getSignedUrl(s3, cmd, {
    expiresIn: params.expiresInSeconds ?? 600,
  });

  const publicUrl = config.publicBaseUrl
    ? `${config.publicBaseUrl.replace(/\/$/, "")}/${params.key}`
    : undefined;

  return { putUrl, publicUrl };
}

export type JobPhotoKind = "before" | "after" | "client_dispute";

/**
 * Build a safe object key for job photos (S3/R2).
 */
export function buildJobPhotoKey(input: {
  jobId: string;
  kind: JobPhotoKind;
  originalFileName: string;
}): string {
  const safeName = input.originalFileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .slice(0, 120);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 10);

  return `jobs/${input.jobId}/${input.kind}/${ts}_${rand}_${safeName}`;
}
