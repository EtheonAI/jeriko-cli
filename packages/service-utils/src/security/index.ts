/**
 * Security Utilities
 * Input sanitization, XSS protection, and security helpers
 */

// HTML entity encoding for XSS prevention
const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Sanitize a string by removing potentially dangerous characters
 */
export function sanitizeString(str: string, options: SanitizeOptions = {}): string {
  const {
    allowHtml = false,
    maxLength = 10000,
    trim = true,
    removeNullBytes = true,
  } = options;

  let result = str;

  // Remove null bytes
  if (removeNullBytes) {
    result = result.replace(/\0/g, "");
  }

  // Trim whitespace
  if (trim) {
    result = result.trim();
  }

  // Escape HTML if not allowed
  if (!allowHtml) {
    result = escapeHtml(result);
  }

  // Enforce max length
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }

  return result;
}

export interface SanitizeOptions {
  allowHtml?: boolean;
  maxLength?: number;
  trim?: boolean;
  removeNullBytes?: boolean;
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: SanitizeOptions = {}
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Sanitize the key
    const sanitizedKey = sanitizeString(key, { ...options, maxLength: 100 });

    if (typeof value === "string") {
      result[sanitizedKey] = sanitizeString(value, options);
    } else if (Array.isArray(value)) {
      result[sanitizedKey] = value.map((item) => {
        if (typeof item === "string") {
          return sanitizeString(item, options);
        } else if (typeof item === "object" && item !== null) {
          return sanitizeObject(item as Record<string, unknown>, options);
        }
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      result[sanitizedKey] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      result[sanitizedKey] = value;
    }
  }

  return result as T;
}

/**
 * SQL injection prevention patterns
 */
const sqlInjectionPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/gi,
  /(--)|(\/\*)|(\*\/)/g,
  /(;|\||\||&&)/g,
  /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
  /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
];

/**
 * Check if a string contains potential SQL injection
 */
export function containsSqlInjection(str: string): boolean {
  return sqlInjectionPatterns.some((pattern) => pattern.test(str));
}

/**
 * NoSQL injection prevention patterns
 */
const noSqlInjectionPatterns = [
  /\$where/gi,
  /\$regex/gi,
  /\$gt/gi,
  /\$lt/gi,
  /\$ne/gi,
  /\$or/gi,
  /\$and/gi,
  /\$not/gi,
  /\$exists/gi,
];

/**
 * Check if a string contains potential NoSQL injection
 */
export function containsNoSqlInjection(str: string): boolean {
  return noSqlInjectionPatterns.some((pattern) => pattern.test(str));
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\?%*:|"<>]/g, "-") // Remove dangerous characters
    .replace(/\.{2,}/g, ".") // Remove multiple dots
    .replace(/^\.+/, "") // Remove leading dots
    .slice(0, 255); // Limit length
}

/**
 * Sanitize URL path
 */
export function sanitizePath(path: string): string {
  return path
    .replace(/\.{2,}/g, "") // Remove directory traversal
    .replace(/[<>:"|?*]/g, "") // Remove invalid characters
    .replace(/\/+/g, "/"); // Normalize slashes
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash a string using SHA-256
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time string comparison (timing attack safe)
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Rate limiting key generator
 */
export function generateRateLimitKey(
  prefix: string,
  identifier: string,
  windowMs: number = 60000
): string {
  const window = Math.floor(Date.now() / windowMs);
  return `${prefix}:${identifier}:${window}`;
}

/**
 * IP address utilities
 */
export function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (parts[0] === 127) return true;

  return false;
}

/**
 * Extract real IP from request headers
 */
export function getRealIP(headers: Record<string, string | string[] | undefined>, defaultIP: string = ""): string {
  // Check common proxy headers
  const forwardedFor = headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(",");
    const realIP = ips[0]?.trim();
    if (realIP) return realIP;
  }

  const realIP = headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  return defaultIP;
}
