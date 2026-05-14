// src/services/__tests__/fileUploadService.test.ts
// Unit tests for file upload service

import { beforeEach, vi } from "vitest";
import {
  uploadFile,
  validateFile,
  validateFileBytes,
  detectFileSignature,
} from "../fileUploadService";

// Minimal valid signatures for each accepted type.
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0]); // "%PDF-1.4"
const WEBP_HEADER = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP", "ascii"),
]);
const EXE_HEADER = Buffer.from([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // "MZ..."

describe("fileUploadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateFile", () => {
    it("validates profile photo types", () => {
      const validFile = {
        mimetype: "image/jpeg",
        size: 1024 * 1024, // 1MB
      };

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      const result = validateFile(validFile, allowedTypes, 5 * 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid file types", () => {
      const invalidFile = {
        mimetype: "application/pdf",
        size: 1024 * 1024,
      };

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      const result = validateFile(invalidFile, allowedTypes, 5 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("type");
    });

    it("rejects files over size limit", () => {
      const largeFile = {
        mimetype: "image/jpeg",
        size: 10 * 1024 * 1024, // 10MB
      };

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      const result = validateFile(largeFile, allowedTypes, 5 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("size");
    });

    it("validates ID document types", () => {
      const validDoc = {
        mimetype: "application/pdf",
        size: 2 * 1024 * 1024, // 2MB
      };

      const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
      const result = validateFile(validDoc, allowedTypes, 10 * 1024 * 1024);
      expect(result.valid).toBe(true);
    });
  });

  describe("detectFileSignature", () => {
    it("recognizes JPEG", () => {
      expect(detectFileSignature(JPEG_HEADER)).toBe("image/jpeg");
    });
    it("recognizes PNG", () => {
      expect(detectFileSignature(PNG_HEADER)).toBe("image/png");
    });
    it("recognizes WebP", () => {
      expect(detectFileSignature(WEBP_HEADER)).toBe("image/webp");
    });
    it("recognizes PDF", () => {
      expect(detectFileSignature(PDF_HEADER)).toBe("application/pdf");
    });
    it("returns null for unknown bytes", () => {
      expect(detectFileSignature(EXE_HEADER)).toBeNull();
    });
    it("returns null for short buffers", () => {
      expect(detectFileSignature(Buffer.from([0xff, 0xd8]))).toBeNull();
    });
  });

  describe("validateFileBytes (magic-number check)", () => {
    const imageTypes = ["image/jpeg", "image/png", "image/webp"];

    it("accepts a JPEG with matching MIME and signature", () => {
      const result = validateFileBytes(
        { mimetype: "image/jpeg", size: 1024, buffer: JPEG_HEADER },
        imageTypes,
        5 * 1024 * 1024
      );
      expect(result.valid).toBe(true);
    });

    it("accepts image/jpg as alias for image/jpeg signature", () => {
      const result = validateFileBytes(
        { mimetype: "image/jpg", size: 1024, buffer: JPEG_HEADER },
        ["image/jpg", "image/jpeg"],
        5 * 1024 * 1024
      );
      expect(result.valid).toBe(true);
    });

    it("rejects when declared MIME does not match signature", () => {
      const result = validateFileBytes(
        { mimetype: "image/jpeg", size: 1024, buffer: PNG_HEADER },
        imageTypes,
        5 * 1024 * 1024
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("do not match");
    });

    it("rejects an .exe sent as image/jpeg", () => {
      const result = validateFileBytes(
        { mimetype: "image/jpeg", size: 1024, buffer: EXE_HEADER },
        imageTypes,
        5 * 1024 * 1024
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a recognized");
    });

    it("rejects oversize even with valid signature", () => {
      const result = validateFileBytes(
        { mimetype: "image/jpeg", size: 99 * 1024 * 1024, buffer: JPEG_HEADER },
        imageTypes,
        5 * 1024 * 1024
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("size");
    });

    it("rejects disallowed declared MIME before reading bytes", () => {
      const result = validateFileBytes(
        { mimetype: "application/x-evil", size: 1024, buffer: JPEG_HEADER },
        imageTypes,
        5 * 1024 * 1024
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("type");
    });
  });

  describe("uploadFile", () => {
    it("uploads file and returns URL", async () => {
      const mockFile = Buffer.from("test file content");

      const result = await uploadFile(mockFile, "user-123", "profile-photos");

      expect(result.url).toBeTruthy();
      expect(result.path).toBeTruthy();
      expect(typeof result.url).toBe("string");
      expect(typeof result.path).toBe("string");
    });

    it("handles upload errors gracefully", async () => {
      const mockFile = null as any;

      await expect(uploadFile(mockFile, "user-123", "profile-photos")).rejects.toThrow();
    });
  });
});
