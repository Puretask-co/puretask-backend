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
