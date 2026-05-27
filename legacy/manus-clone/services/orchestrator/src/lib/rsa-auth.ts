/**
 * RSA request signing for sandbox API calls.
 *
 * Manus pattern: X-Sandbox-Api-Signature-V2 header on EVERY request
 * from orchestrator to sandbox.
 *
 * The orchestrator signs the request body with its RSA private key.
 * The sandbox runtime verifies with the baked-in public key.
 */

import crypto from 'crypto';
import fs from 'fs';

const RSA_PRIVATE_KEY_PATH = process.env.RSA_PRIVATE_KEY_PATH || '';

let _privateKey: string | null = null;
let _enabled = false;

/**
 * Initialize RSA signing. Call once at startup.
 * Silently disables if no private key is found.
 */
export function initRsaSigning(): void {
  if (!RSA_PRIVATE_KEY_PATH) {
    console.log('[rsa-auth] RSA_PRIVATE_KEY_PATH not set — signing disabled');
    return;
  }

  try {
    _privateKey = fs.readFileSync(RSA_PRIVATE_KEY_PATH, 'utf-8');
    _enabled = true;
    console.log('[rsa-auth] RSA private key loaded — signing enabled');
  } catch (error) {
    console.warn('[rsa-auth] Failed to load RSA private key:', error);
  }
}

/** Whether RSA signing is enabled. */
export function isRsaSigningEnabled(): boolean {
  return _enabled;
}

/**
 * Sign a request body with the RSA private key.
 *
 * @param body - JSON string of the request body
 * @returns Base64-encoded RSA-SHA256 signature
 */
export function signRequest(body: string): string {
  if (!_privateKey) {
    throw new Error('RSA signing not initialized');
  }

  const sign = crypto.createSign('SHA256');
  sign.update(body);
  return sign.sign(_privateKey, 'base64');
}

/**
 * Get RSA signature headers for a request.
 * Returns empty object if signing is disabled.
 */
export function getRsaHeaders(body: string): Record<string, string> {
  if (!_enabled || !_privateKey) {
    return {};
  }

  return {
    'X-Sandbox-Api-Signature-V2': signRequest(body),
  };
}
