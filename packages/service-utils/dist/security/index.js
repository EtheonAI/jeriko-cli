// src/security/index.ts
var htmlEntities = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;"
};
function escapeHtml(str) {
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}
function sanitizeString(str, options = {}) {
  const {
    allowHtml = false,
    maxLength = 1e4,
    trim = true,
    removeNullBytes = true
  } = options;
  let result = str;
  if (removeNullBytes) {
    result = result.replace(/\0/g, "");
  }
  if (trim) {
    result = result.trim();
  }
  if (!allowHtml) {
    result = escapeHtml(result);
  }
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  return result;
}
function sanitizeObject(obj, options = {}) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key, { ...options, maxLength: 100 });
    if (typeof value === "string") {
      result[sanitizedKey] = sanitizeString(value, options);
    } else if (Array.isArray(value)) {
      result[sanitizedKey] = value.map((item) => {
        if (typeof item === "string") {
          return sanitizeString(item, options);
        } else if (typeof item === "object" && item !== null) {
          return sanitizeObject(item, options);
        }
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      result[sanitizedKey] = sanitizeObject(value, options);
    } else {
      result[sanitizedKey] = value;
    }
  }
  return result;
}
var sqlInjectionPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/gi,
  /(--)|(\/\*)|(\*\/)/g,
  /(;|\||\||&&)/g,
  /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
  /(\bAND\b\s*\d+\s*=\s*\d+)/gi
];
function containsSqlInjection(str) {
  return sqlInjectionPatterns.some((pattern) => pattern.test(str));
}
var noSqlInjectionPatterns = [
  /\$where/gi,
  /\$regex/gi,
  /\$gt/gi,
  /\$lt/gi,
  /\$ne/gi,
  /\$or/gi,
  /\$and/gi,
  /\$not/gi,
  /\$exists/gi
];
function containsNoSqlInjection(str) {
  return noSqlInjectionPatterns.some((pattern) => pattern.test(str));
}
function sanitizeEmail(email) {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}
function sanitizeFilename(filename) {
  return filename.replace(/[/\\?%*:|"<>]/g, "-").replace(/\.{2,}/g, ".").replace(/^\.+/, "").slice(0, 255);
}
function sanitizePath(path) {
  return path.replace(/\.{2,}/g, "").replace(/[<>:"|?*]/g, "").replace(/\/+/g, "/");
}
function generateSecureToken(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function secureCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
function generateRateLimitKey(prefix, identifier, windowMs = 6e4) {
  const window = Math.floor(Date.now() / windowMs);
  return `${prefix}:${identifier}:${window}`;
}
function isPrivateIP(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  return false;
}
function getRealIP(headers, defaultIP = "") {
  const forwardedFor = headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(",");
    const realIP2 = ips[0]?.trim();
    if (realIP2) return realIP2;
  }
  const realIP = headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  return defaultIP;
}
export {
  containsNoSqlInjection,
  containsSqlInjection,
  escapeHtml,
  generateRateLimitKey,
  generateSecureToken,
  getRealIP,
  hashString,
  isPrivateIP,
  sanitizeEmail,
  sanitizeFilename,
  sanitizeObject,
  sanitizePath,
  sanitizeString,
  secureCompare
};
//# sourceMappingURL=index.js.map