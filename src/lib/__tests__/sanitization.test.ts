// src/lib/__tests__/sanitization.test.ts
// Unit tests for input sanitization utilities

import { describe, it, expect } from '@jest/globals';
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhone,
  sanitizeSql,
} from '../sanitization';

describe('sanitization utilities', () => {
  describe('sanitizeHtml', () => {
    it('removes script tags', () => {
      const input = "<script>alert('xss')</script>Hello";
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('</script>');
      expect(output).toContain('Hello');
    });

    it('removes event handlers', () => {
      const input = '<div onclick="alert(\'xss\')">Click me</div>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onclick');
    });

    it('removes javascript: protocol', () => {
      const input = '<a href="javascript:alert(\'xss\')">Link</a>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('javascript:');
    });

    it('preserves safe HTML', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const output = sanitizeHtml(input);
      expect(output).toContain('Hello');
      expect(output).toContain('world');
    });

    it('handles empty string', () => {
      expect(sanitizeHtml('')).toBe('');
    });
  });

  describe('sanitizeText', () => {
    it('removes all HTML tags', () => {
      const input = '<b>Bold</b> and <i>italic</i> text';
      const output = sanitizeText(input);
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
      expect(output).toContain('Bold');
      expect(output).toContain('italic');
    });

    it('preserves plain text', () => {
      const input = 'Plain text without HTML';
      expect(sanitizeText(input)).toBe(input);
    });
  });

  describe('sanitizeEmail', () => {
    it('validates correct email format', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
      expect(sanitizeEmail('user.name+tag@domain.co.uk')).toBe('user.name+tag@domain.co.uk');
    });

    it('rejects invalid email formats', () => {
      expect(sanitizeEmail('invalid-email')).toBeNull();
      expect(sanitizeEmail('@example.com')).toBeNull();
      expect(sanitizeEmail('test@')).toBeNull();
      expect(sanitizeEmail('test@.com')).toBeNull();
    });

    it('trims whitespace', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    it('converts to lowercase', () => {
      expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });
  });

  describe('sanitizeUrl', () => {
    it('validates correct URL format', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeUrl('http://example.com/path')).toBe('http://example.com/path');
    });

    it('rejects javascript: protocol', () => {
      expect(sanitizeUrl('javascript:alert("xss")')).toBeNull();
    });

    it('rejects data: protocol', () => {
      expect(sanitizeUrl('data:text/html,<script>alert("xss")</script>')).toBeNull();
    });

    it('rejects invalid URLs', () => {
      expect(sanitizeUrl('not-a-url')).toBeNull();
      expect(sanitizeUrl('ftp://example.com')).toBeNull(); // Only http/https allowed
    });
  });

  describe('sanitizePhone', () => {
    it('formats US phone numbers', () => {
      expect(sanitizePhone('1234567890')).toMatch(/^\+1/);
      expect(sanitizePhone('(123) 456-7890')).toMatch(/^\+1/);
    });

    it('validates phone number format', () => {
      const valid = sanitizePhone('1234567890');
      expect(valid).toBeTruthy();
      expect(valid).toMatch(/^\+1\d{10}$/);
    });

    it('rejects invalid phone numbers', () => {
      expect(sanitizePhone('123')).toBeNull();
      expect(sanitizePhone('abc123')).toBeNull();
    });
  });

  describe('sanitizeSql', () => {
    it('detects SQL injection patterns', () => {
      const malicious = "'; DROP TABLE users; --";
      const output = sanitizeSql(malicious);
      expect(output).not.toContain('DROP');
      expect(output).not.toContain('--');
    });

    it('preserves safe text', () => {
      const safe = "SELECT * FROM users WHERE id = '123'";
      // Note: This is a basic check - in production, use parameterized queries
      const output = sanitizeSql(safe);
      expect(output).toBeTruthy();
    });
  });
});
