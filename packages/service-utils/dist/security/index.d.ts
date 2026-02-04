/**
 * Security Utilities
 * Input sanitization, XSS protection, and security helpers
 */
/**
 * Escape HTML special characters to prevent XSS
 */
declare function escapeHtml(str: string): string;
/**
 * Sanitize a string by removing potentially dangerous characters
 */
declare function sanitizeString(str: string, options?: SanitizeOptions): string;
interface SanitizeOptions {
    allowHtml?: boolean;
    maxLength?: number;
    trim?: boolean;
    removeNullBytes?: boolean;
}
/**
 * Sanitize an object recursively
 */
declare function sanitizeObject<T extends Record<string, unknown>>(obj: T, options?: SanitizeOptions): T;
/**
 * Check if a string contains potential SQL injection
 */
declare function containsSqlInjection(str: string): boolean;
/**
 * Check if a string contains potential NoSQL injection
 */
declare function containsNoSqlInjection(str: string): boolean;
/**
 * Validate and sanitize email
 */
declare function sanitizeEmail(email: string): string | null;
/**
 * Sanitize filename to prevent path traversal
 */
declare function sanitizeFilename(filename: string): string;
/**
 * Sanitize URL path
 */
declare function sanitizePath(path: string): string;
/**
 * Generate a secure random token
 */
declare function generateSecureToken(length?: number): string;
/**
 * Hash a string using SHA-256
 */
declare function hashString(str: string): Promise<string>;
/**
 * Constant-time string comparison (timing attack safe)
 */
declare function secureCompare(a: string, b: string): boolean;
/**
 * Rate limiting key generator
 */
declare function generateRateLimitKey(prefix: string, identifier: string, windowMs?: number): string;
/**
 * IP address utilities
 */
declare function isPrivateIP(ip: string): boolean;
/**
 * Extract real IP from request headers
 */
declare function getRealIP(headers: Record<string, string | string[] | undefined>, defaultIP?: string): string;

export { type SanitizeOptions, containsNoSqlInjection, containsSqlInjection, escapeHtml, generateRateLimitKey, generateSecureToken, getRealIP, hashString, isPrivateIP, sanitizeEmail, sanitizeFilename, sanitizeObject, sanitizePath, sanitizeString, secureCompare };
