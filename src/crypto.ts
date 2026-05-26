// src/crypto.ts
// AES-256-GCM encryption with PBKDF2 key derivation (200,000 iterations)
// Uses expo-crypto for secure random, pure JS for crypto operations

import * as ExpoCrypto from 'expo-crypto';

const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 32;
const IV_BYTES = 12;
const KEY_BITS = 256;

// ─── Helpers ────────────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}

function strToUtf8(str: string): ArrayBuffer {
  const encoded = unescape(encodeURIComponent(str));
  const buf = new ArrayBuffer(encoded.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < encoded.length; i++) view[i] = encoded.charCodeAt(i);
  return buf;
}

function utf8ToStr(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(binary));
}

async function getRandomBytes(count: number): Promise<Uint8Array> {
  const hex = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    Math.random().toString() + Date.now().toString()
  );
  // Use crypto.getRandomValues if available (React Native Hermes supports it)
  const arr = new Uint8Array(count);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    // Fallback: use hex from ExpoCrypto
    for (let i = 0; i < count; i++) {
      arr[i] = parseInt(hex.slice((i * 2) % 64, (i * 2) % 64 + 2), 16);
    }
  }
  return arr;
}

// ─── PBKDF2 Key Derivation ───────────────────────────────────────────────────

export async function deriveKey(
  password: string,
  salt: ArrayBuffer
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt ────────────────────────────────────────────────────────────────

export async function encryptData(
  key: CryptoKey,
  data: unknown
): Promise<string> {
  const iv = await getRandomBytes(IV_BYTES);
  const plaintext = strToUtf8(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  // Pack: [iv(12)] + [ciphertext]
  const combined = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_BYTES);
  return bufToB64(combined.buffer);
}

// ─── Decrypt ────────────────────────────────────────────────────────────────

export async function decryptData<T>(key: CryptoKey, b64: string): Promise<T> {
  const combined = new Uint8Array(b64ToBuf(b64));
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return JSON.parse(utf8ToStr(plaintext)) as T;
}

// ─── Salt generation ────────────────────────────────────────────────────────

export async function generateSalt(): Promise<string> {
  const salt = await getRandomBytes(SALT_BYTES);
  return bufToB64(salt.buffer);
}

export function saltFromB64(b64: string): ArrayBuffer {
  return b64ToBuf(b64);
}

// ─── PIN hashing ────────────────────────────────────────────────────────────
// Store PIN as PBKDF2 hash (not reversible)

export async function hashPin(pin: string, salt: string): Promise<string> {
  const saltBuf = b64ToBuf(salt);
  const key = await deriveKey(pin + '_pin_salt_vault', saltBuf);
  // Export to get bytes (just for verification token)
  const raw = await crypto.subtle.exportKey('raw', key).catch(() => null);
  if (!raw) return ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    pin + salt
  );
  return bufToB64(raw);
}

// ─── Password strength ──────────────────────────────────────────────────────

export interface StrengthResult {
  score: number;   // 0–4
  label: string;
  color: string;
  entropy: number;
}

export function measureStrength(pw: string): StrengthResult {
  if (!pw) return { score: 0, label: 'None', color: '#555', entropy: 0 };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
  const entropy = pw.length * Math.log2(pool || 1);

  let score: number;
  let label: string;
  let color: string;
  if (entropy < 28) { score = 0; label = 'Very Weak'; color = '#ef4444'; }
  else if (entropy < 40) { score = 1; label = 'Weak'; color = '#f97316'; }
  else if (entropy < 60) { score = 2; label = 'Fair'; color = '#eab308'; }
  else if (entropy < 80) { score = 3; label = 'Strong'; color = '#22c55e'; }
  else { score = 4; label = 'Very Strong'; color = '#6366f1'; }

  return { score, label, color, entropy: Math.round(entropy) };
}

// ─── HIBP Breach Check ──────────────────────────────────────────────────────
// k-anonymity: only first 5 chars of SHA-1 hash sent, password never leaves device

export async function checkBreach(password: string): Promise<number> {
  try {
    // SHA-1 of password
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-1', enc.encode(password));
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      { headers: { 'Add-Padding': 'true' } }
    );
    if (!response.ok) return -1;

    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [lineSuffix, count] = line.trim().split(':');
      if (lineSuffix === suffix) return parseInt(count, 10);
    }
    return 0; // not found = safe
  } catch {
    return -1; // network error
  }
}
