// src/totp.ts
// RFC 6238 TOTP implementation (HMAC-SHA1 based)

function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/\s+/g, '').replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

function intToBytes(num: number): Uint8Array {
  const arr = new Uint8Array(8);
  let tmp = num;
  for (let i = 7; i >= 0; i--) {
    arr[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  return arr;
}

export async function generateTOTP(secret: string, timeStep = 30): Promise<string> {
  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    const counterBytes = intToBytes(counter);
    const hmac = await hmacSha1(key, counterBytes);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 1_000_000).padStart(6, '0');
  } catch {
    return '------';
  }
}

export function totpSecondsLeft(timeStep = 30): number {
  return timeStep - (Math.floor(Date.now() / 1000) % timeStep);
}

export function formatTotpCode(code: string): string {
  return code.slice(0, 3) + ' ' + code.slice(3);
}
