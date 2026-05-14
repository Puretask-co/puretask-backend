// src/services/fileUploadService.ts
// File upload service for profile photos and ID documents

import { logger } from "../lib/logger";
import { env } from "../config/env";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";

// For now, using local storage. In production, use S3 or Cloudinary
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure upload directory exists
async function ensureUploadDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Upload file to storage
 * @param file - File buffer or stream
 * @param userId - User ID
 * @param folder - Folder name (e.g., 'profile-photos', 'identity-documents')
 * @param filename - Optional custom filename
 * @returns URL/path to uploaded file
 */
export async function uploadFile(
  file: Buffer | NodeJS.ReadableStream,
  userId: string,
  folder: "profile-photos" | "identity-documents",
  filename?: string
): Promise<{ url: string; path: string }> {
  try {
    const folderPath = path.join(UPLOAD_DIR, folder, userId);
    await ensureUploadDir(folderPath);

    const ext = filename?.split(".").pop() || "jpg";
    const finalFilename = filename || `${uuidv4()}.${ext}`;
    const filePath = path.join(folderPath, finalFilename);

    // Write file
    if (Buffer.isBuffer(file)) {
      await fs.writeFile(filePath, file);
    } else {
      const writeStream = createWriteStream(filePath);
      await pipeline(file, writeStream);
    }

    // In production, upload to S3/Cloudinary here
    // For now, return relative path
    const url = `/uploads/${folder}/${userId}/${finalFilename}`;

    logger.info("file_uploaded", { userId, folder, filename: finalFilename });

    return { url, path: filePath };
  } catch (error: any) {
    logger.error("file_upload_failed", {
      userId,
      folder,
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Failed to upload file");
  }
}

/**
 * Delete file from storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    logger.info("file_deleted", { filePath });
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      logger.error("file_delete_failed", { filePath, error: error.message });
      throw error;
    }
  }
}

/**
 * Validate file
 *
 * NOTE: this is the legacy MIME-only validator kept for callsites that
 * don't have the file buffer at hand. For new code, prefer
 * `validateFileBytes()` below — it also verifies the file's magic-number
 * signature against the declared MIME so a `.exe` masquerading as
 * `image/jpeg` is rejected.
 * See docs/active/AUDIT_REANALYSIS_2026-05-13.md § B.7.
 */
export function validateFile(
  file: { size: number; mimetype: string },
  allowedTypes: string[],
  maxSize: number = MAX_FILE_SIZE
): { valid: boolean; error?: string } {
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Detect a file's actual type from the first bytes of its buffer.
 * Returns the canonical MIME for the detected format, or null if
 * the bytes don't match any of the formats this app accepts.
 *
 * We accept: JPEG, PNG, WebP, HEIC/HEIF, PDF. Anything else is rejected.
 */
export function detectFileSignature(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  // HEIC/HEIF: ISO BMFF container — bytes 4-7 = "ftyp",
  // brand at 8-11 in {heic, heix, hevc, hevx, mif1, msf1}
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }
  // PDF: %PDF
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }
  return null;
}

// Some clients send `image/jpg` (incorrect) for what is really `image/jpeg`.
const MIME_NORMALIZE: Record<string, string> = {
  "image/jpg": "image/jpeg",
};

function normalize(mime: string): string {
  return MIME_NORMALIZE[mime] ?? mime;
}

/**
 * Strict file validator. Performs size + declared-MIME-allowlist check
 * (same as validateFile), then verifies the buffer's magic-number signature
 * matches the declared MIME.
 *
 * Rejects:
 * - oversize files
 * - MIME types outside `allowedTypes`
 * - files whose declared MIME doesn't match the actual file signature
 *   (e.g. a .exe sent with `Content-Type: image/jpeg`)
 * - files whose signature isn't one of the recognized formats
 */
export function validateFileBytes(
  file: { size: number; mimetype: string; buffer: Buffer },
  allowedTypes: string[],
  maxSize: number = MAX_FILE_SIZE
): { valid: boolean; error?: string } {
  // Reuse the cheap checks first.
  const basic = validateFile(file, allowedTypes, maxSize);
  if (!basic.valid) return basic;

  const detected = detectFileSignature(file.buffer);
  if (!detected) {
    return {
      valid: false,
      error: "File contents are not a recognized image or PDF",
    };
  }

  if (normalize(detected) !== normalize(file.mimetype)) {
    return {
      valid: false,
      error: `File contents (${detected}) do not match declared type (${file.mimetype})`,
    };
  }

  return { valid: true };
}

/**
 * Allowed MIME types for profile photos (Section 8: MIME allowlist; no raw binary)
 */
export const PROFILE_PHOTO_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic", // iPhone photos
];

/**
 * Allowed MIME types for ID documents
 */
export const ID_DOCUMENT_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
