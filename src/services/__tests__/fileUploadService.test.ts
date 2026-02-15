// src/services/__tests__/fileUploadService.test.ts
// Unit tests for file upload service

import { beforeEach, vi } from "vitest";
import { uploadFile, validateFile } from "../fileUploadService";

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
