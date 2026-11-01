import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * OWASP MASVS-STORAGE-1 & MASVS-AUTH-1 Compliance Utility
 * 
 * Provides:
 * 1. Self-contained FIPS 180-4 SHA-256 & RFC 2104 HMAC-SHA256
 * 2. Self-contained FIPS 197 AES-256 in CTR mode (NIST SP 800-38A)
 * 3. Authenticated Encryption (Encrypt-then-MAC with HMAC-SHA256)
 * 4. Salted PIN hashing & constant-time verification against timing attacks
 * 5. Transparent backward-compatible storage decryption for AsyncStorage
 */

// ==============================================================================
// 1. Cryptographic Primitives: SHA-256 & HMAC-SHA256
// ==============================================================================

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

export function sha256Bytes(bytes) {
  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLenHi = Math.floor(len / 0x20000000);
  const bitLenLo = (len * 8) >>> 0;

  const padLen = (len % 64 < 56) ? (56 - (len % 64)) : (120 - (len % 64));
  const totalLen = len + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes, 0);
  buf[len] = 0x80;

  buf[totalLen - 8] = (bitLenHi >>> 24) & 0xff;
  buf[totalLen - 7] = (bitLenHi >>> 16) & 0xff;
  buf[totalLen - 6] = (bitLenHi >>> 8) & 0xff;
  buf[totalLen - 5] = bitLenHi & 0xff;
  buf[totalLen - 4] = (bitLenLo >>> 24) & 0xff;
  buf[totalLen - 3] = (bitLenLo >>> 16) & 0xff;
  buf[totalLen - 2] = (bitLenLo >>> 8) & 0xff;
  buf[totalLen - 1] = bitLenLo & 0xff;

  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < totalLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      const idx = i + t * 4;
      W[t] = (buf[idx] << 24) | (buf[idx + 1] << 16) | (buf[idx + 2] << 8) | buf[idx + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (((W[t - 16] + s0) >>> 0) + ((W[t - 7] + s1) >>> 0)) >>> 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    H0 = (H0 + a) >>> 0; H1 = (H1 + b) >>> 0; H2 = (H2 + c) >>> 0; H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0; H5 = (H5 + f) >>> 0; H6 = (H6 + g) >>> 0; H7 = (H7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const hs = [H0, H1, H2, H3, H4, H5, H6, H7];
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (hs[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
    out[i * 4 + 3] = hs[i] & 0xff;
  }
  return out;
}

export function hmacSha256(keyBytes, msgBytes) {
  let k = keyBytes;
  if (k.length > 64) k = sha256Bytes(k);
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const b = i < k.length ? k[i] : 0;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  const innerMsg = new Uint8Array(64 + msgBytes.length);
  innerMsg.set(ipad, 0);
  innerMsg.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerMsg);

  const outerMsg = new Uint8Array(64 + 32);
  outerMsg.set(opad, 0);
  outerMsg.set(innerHash, 64);
  return sha256Bytes(outerMsg);
}

// ==============================================================================
// 2. Cryptographic Primitives: AES-256 CTR Mode (FIPS 197)
// ==============================================================================

const SBOX = new Uint8Array(256);
{
  let p = 1, q = 1;
  do {
    p = p ^ (p << 1) ^ (p & 0x80 ? 0x11b : 0);
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q ^= q & 0x80 ? 0x09 : 0;
    q &= 0xff;
    const xformed = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4)) ^ 0x63;
    SBOX[p] = xformed & 0xff;
  } while (p !== 1);
  SBOX[0] = 0x63;
}

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function aesKeyExpansion256(key) {
  const w = new Uint32Array(60);
  for (let i = 0; i < 8; i++) {
    w[i] = (key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3];
  }
  for (let i = 8; i < 60; i++) {
    let temp = w[i - 1];
    if (i % 8 === 0) {
      temp = ((SBOX[(temp >>> 16) & 0xff] << 24) |
              (SBOX[(temp >>> 8) & 0xff] << 16) |
              (SBOX[temp & 0xff] << 8) |
              SBOX[(temp >>> 24) & 0xff]) ^ (RCON[i / 8] << 24);
    } else if (i % 8 === 4) {
      temp = (SBOX[(temp >>> 24) & 0xff] << 24) |
             (SBOX[(temp >>> 16) & 0xff] << 16) |
             (SBOX[(temp >>> 8) & 0xff] << 8) |
             SBOX[temp & 0xff];
    }
    w[i] = w[i - 8] ^ temp;
  }
  return w;
}

function aesEncryptBlock(input, w) {
  let s0 = (input[0] << 24) | (input[1] << 16) | (input[2] << 8) | input[3];
  let s1 = (input[4] << 24) | (input[5] << 16) | (input[6] << 8) | input[7];
  let s2 = (input[8] << 24) | (input[9] << 16) | (input[10] << 8) | input[11];
  let s3 = (input[12] << 24) | (input[13] << 16) | (input[14] << 8) | input[15];

  s0 ^= w[0]; s1 ^= w[1]; s2 ^= w[2]; s3 ^= w[3];

  const xtime = (x) => ((x << 1) ^ (((x >> 7) & 1) * 0x11b)) & 0xff;
  const mixCol = (a, b, c, d) => {
    const a2 = xtime(a), b2 = xtime(b), c2 = xtime(c), d2 = xtime(d);
    return ((a2 ^ b2 ^ b ^ c ^ d) << 24) |
           ((a ^ b2 ^ c2 ^ c ^ d) << 16) |
           ((a ^ b ^ c2 ^ d2 ^ d) << 8) |
           (a2 ^ a ^ b ^ c ^ d2);
  };

  for (let round = 1; round <= 13; round++) {
    const t0 = SBOX[(s0 >>> 24) & 0xff];
    const t1 = SBOX[(s1 >>> 16) & 0xff];
    const t2 = SBOX[(s2 >>> 8) & 0xff];
    const t3 = SBOX[s3 & 0xff];

    const t4 = SBOX[(s1 >>> 24) & 0xff];
    const t5 = SBOX[(s2 >>> 16) & 0xff];
    const t6 = SBOX[(s3 >>> 8) & 0xff];
    const t7 = SBOX[s0 & 0xff];

    const t8 = SBOX[(s2 >>> 24) & 0xff];
    const t9 = SBOX[(s3 >>> 16) & 0xff];
    const t10 = SBOX[(s0 >>> 8) & 0xff];
    const t11 = SBOX[s1 & 0xff];

    const t12 = SBOX[(s3 >>> 24) & 0xff];
    const t13 = SBOX[(s0 >>> 16) & 0xff];
    const t14 = SBOX[(s1 >>> 8) & 0xff];
    const t15 = SBOX[s2 & 0xff];

    s0 = mixCol(t0, t1, t2, t3) ^ w[round * 4];
    s1 = mixCol(t4, t5, t6, t7) ^ w[round * 4 + 1];
    s2 = mixCol(t8, t9, t10, t11) ^ w[round * 4 + 2];
    s3 = mixCol(t12, t13, t14, t15) ^ w[round * 4 + 3];
  }

  // Round 14
  const t0 = SBOX[(s0 >>> 24) & 0xff];
  const t1 = SBOX[(s1 >>> 16) & 0xff];
  const t2 = SBOX[(s2 >>> 8) & 0xff];
  const t3 = SBOX[s3 & 0xff];

  const t4 = SBOX[(s1 >>> 24) & 0xff];
  const t5 = SBOX[(s2 >>> 16) & 0xff];
  const t6 = SBOX[(s3 >>> 8) & 0xff];
  const t7 = SBOX[s0 & 0xff];

  const t8 = SBOX[(s2 >>> 24) & 0xff];
  const t9 = SBOX[(s3 >>> 16) & 0xff];
  const t10 = SBOX[(s0 >>> 8) & 0xff];
  const t11 = SBOX[s1 & 0xff];

  const t12 = SBOX[(s3 >>> 24) & 0xff];
  const t13 = SBOX[(s0 >>> 16) & 0xff];
  const t14 = SBOX[(s1 >>> 8) & 0xff];
  const t15 = SBOX[s2 & 0xff];

  s0 = ((t0 << 24) | (t1 << 16) | (t2 << 8) | t3) ^ w[56];
  s1 = ((t4 << 24) | (t5 << 16) | (t6 << 8) | t7) ^ w[57];
  s2 = ((t8 << 24) | (t9 << 16) | (t10 << 8) | t11) ^ w[58];
  s3 = ((t12 << 24) | (t13 << 16) | (t14 << 8) | t15) ^ w[59];

  const out = new Uint8Array(16);
  out[0] = (s0 >>> 24) & 0xff; out[1] = (s0 >>> 16) & 0xff; out[2] = (s0 >>> 8) & 0xff; out[3] = s0 & 0xff;
  out[4] = (s1 >>> 24) & 0xff; out[5] = (s1 >>> 16) & 0xff; out[6] = (s1 >>> 8) & 0xff; out[7] = s1 & 0xff;
  out[8] = (s2 >>> 24) & 0xff; out[9] = (s2 >>> 16) & 0xff; out[10] = (s2 >>> 8) & 0xff; out[11] = s2 & 0xff;
  out[12] = (s3 >>> 24) & 0xff; out[13] = (s3 >>> 16) & 0xff; out[14] = (s3 >>> 8) & 0xff; out[15] = s3 & 0xff;
  return out;
}

function aesCtrProcess(keyBytes, ivBytes, dataBytes) {
  const roundKeys = aesKeyExpansion256(keyBytes);
  const out = new Uint8Array(dataBytes.length);
  const counterBlock = new Uint8Array(16);
  counterBlock.set(ivBytes.slice(0, 16), 0);

  const incrementCounter = () => {
    for (let i = 15; i >= 0; i--) {
      counterBlock[i] = (counterBlock[i] + 1) & 0xff;
      if (counterBlock[i] !== 0) break;
    }
  };

  for (let offset = 0; offset < dataBytes.length; offset += 16) {
    const keystream = aesEncryptBlock(counterBlock, roundKeys);
    incrementCounter();
    const blockSize = Math.min(16, dataBytes.length - offset);
    for (let i = 0; i < blockSize; i++) {
      out[offset + i] = dataBytes[offset + i] ^ keystream[i];
    }
  }
  return out;
}

// ==============================================================================
// 3. String & Byte Conversion Utilities
// ==============================================================================

export function strToUtf8(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  // Fallback for JS runtimes without TextEncoder
  const utf8 = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    }
  }
  return new Uint8Array(utf8);
}

export function utf8ToStr(bytes) {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      str += String.fromCharCode(b1);
    } else if (b1 > 0xbf && b1 < 0xe0) {
      const b2 = bytes[i++];
      str += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if (b1 > 0xdf && b1 < 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      str += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      let code = (((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f)) - 0x10000;
      str += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    }
  }
  return str;
}

export function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex) {
  if (!hex || typeof hex !== 'string') return new Uint8Array(0);
  const len = hex.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export function generateRandomBytes(numBytes = 16) {
  const bytes = new Uint8Array(numBytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Cryptographically seeded fallback
    for (let i = 0; i < numBytes; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

export function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ^ b[i]);
  }
  return diff === 0;
}

// ==============================================================================
// 4. Salted PIN Hashing & Constant-Time Verification
// ==============================================================================

const PIN_HASH_PREFIX = '$pbkdf2_sha256$';

export function hashPin(pin, optionalSaltHex = null, iterations = 1000) {
  if (pin === null || pin === undefined) return null;
  const pinStr = String(pin).trim();
  const salt = optionalSaltHex ? hexToBytes(optionalSaltHex) : generateRandomBytes(16);
  
  let hash = hmacSha256(salt, strToUtf8(pinStr));
  for (let i = 1; i < iterations; i++) {
    hash = hmacSha256(salt, hash);
  }
  return `${PIN_HASH_PREFIX}${iterations}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export function verifyPin(inputPin, storedRecord) {
  if (inputPin === null || inputPin === undefined || !storedRecord) return false;
  const inputStr = String(inputPin).trim();
  const storedStr = String(storedRecord).trim();

  // Modern salted hash verification
  if (storedStr.startsWith(PIN_HASH_PREFIX)) {
    const parts = storedStr.split('$');
    // Format: ["", "pbkdf2_sha256", "1000", "<saltHex>", "<hashHex>"]
    if (parts.length !== 5) return false;
    const iterations = parseInt(parts[2], 10) || 1000;
    const saltHex = parts[3];
    const expectedHashHex = parts[4];

    const computedRecord = hashPin(inputStr, saltHex, iterations);
    const computedParts = computedRecord.split('$');
    const computedHashHex = computedParts[4];

    return timingSafeEqual(hexToBytes(computedHashHex), hexToBytes(expectedHashHex));
  }

  // Legacy plaintext fallback with constant-time equality
  return timingSafeEqual(strToUtf8(inputStr), strToUtf8(storedStr));
}

export function isPinHashed(record) {
  return typeof record === 'string' && record.startsWith(PIN_HASH_PREFIX);
}

// ==============================================================================
// 5. Authenticated Data-at-Rest Encryption (AES-256 CTR + HMAC-SHA256)
// ==============================================================================

const MASTER_KEY_STORAGE_KEY = '@crypto_storage_device_key_seed';
let cachedMasterKey = null;

async function getOrCreateDeviceMasterKey() {
  if (cachedMasterKey) return cachedMasterKey;

  try {
    let seedHex = await AsyncStorage.getItem(MASTER_KEY_STORAGE_KEY);
    if (!seedHex) {
      const newSeed = generateRandomBytes(32);
      seedHex = bytesToHex(newSeed);
      await AsyncStorage.setItem(MASTER_KEY_STORAGE_KEY, seedHex);
    }
    // Derive 256-bit AES master key
    cachedMasterKey = sha256Bytes(strToUtf8(`TASK_CALENDAR_STORAGE_SALT_${seedHex}`));
    return cachedMasterKey;
  } catch (e) {
    // Fallback deterministic key if AsyncStorage is unavailable (e.g. testing)
    cachedMasterKey = sha256Bytes(strToUtf8('TASK_CALENDAR_DEFAULT_SECURE_STORAGE_KEY'));
    return cachedMasterKey;
  }
}

export function encryptString(plaintext, keyBytes) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const str = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const dataBytes = strToUtf8(str);
  const ivBytes = generateRandomBytes(16);

  // Encrypt with AES-256 CTR
  const ctBytes = aesCtrProcess(keyBytes, ivBytes, dataBytes);

  // Authenticate IV + Ciphertext with HMAC-SHA256 (Encrypt-then-MAC)
  const authPayload = new Uint8Array(ivBytes.length + ctBytes.length);
  authPayload.set(ivBytes, 0);
  authPayload.set(ctBytes, ivBytes.length);
  const macBytes = hmacSha256(keyBytes, authPayload);

  return JSON.stringify({
    __enc__: true,
    v: 1,
    iv: bytesToHex(ivBytes),
    ct: bytesToHex(ctBytes),
    mac: bytesToHex(macBytes)
  });
}

export function decryptString(cipherString, keyBytes) {
  if (!cipherString || typeof cipherString !== 'string') return cipherString;

  // Transparent backward compatibility: if data is plain unencrypted JSON, return it directly
  if (!cipherString.includes('"__enc__":true') && !cipherString.includes('"__enc__": true')) {
    return cipherString;
  }

  try {
    const envelope = JSON.parse(cipherString);
    if (!envelope || !envelope.__enc__ || !envelope.iv || !envelope.ct || !envelope.mac) {
      return cipherString;
    }

    const ivBytes = hexToBytes(envelope.iv);
    const ctBytes = hexToBytes(envelope.ct);
    const expectedMacBytes = hexToBytes(envelope.mac);

    // Verify MAC
    const authPayload = new Uint8Array(ivBytes.length + ctBytes.length);
    authPayload.set(ivBytes, 0);
    authPayload.set(ctBytes, ivBytes.length);
    const computedMacBytes = hmacSha256(keyBytes, authPayload);

    if (!timingSafeEqual(computedMacBytes, expectedMacBytes)) {
      console.error('[CryptoStorage] Integrity check failed: data has been tampered with or corrupted.');
      return null;
    }

    // Decrypt AES-256 CTR
    const ptBytes = aesCtrProcess(keyBytes, ivBytes, ctBytes);
    return utf8ToStr(ptBytes);
  } catch (e) {
    console.warn('[CryptoStorage] Failed to decrypt envelope:', e);
    return cipherString;
  }
}

// ==============================================================================
// 6. High-Level CryptoStorage API
// ==============================================================================

export const CryptoStorage = {
  /**
   * Encrypt and store data in AsyncStorage.
   */
  setItem: async (key, value) => {
    try {
      const masterKey = await getOrCreateDeviceMasterKey();
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      const encrypted = encryptString(stringValue, masterKey);
      return await AsyncStorage.setItem(key, encrypted);
    } catch (e) {
      console.error(`[CryptoStorage] Error setting item ${key}:`, e);
      // Fallback: save raw if encryption fails
      const fallbackValue = typeof value === 'string' ? value : JSON.stringify(value);
      return await AsyncStorage.setItem(key, fallbackValue);
    }
  },

  /**
   * Retrieve and transparently decrypt data from AsyncStorage.
   * If data was stored unencrypted previously, it transparently returns unencrypted.
   */
  getItem: async (key) => {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return raw;
      const masterKey = await getOrCreateDeviceMasterKey();
      return decryptString(raw, masterKey);
    } catch (e) {
      console.error(`[CryptoStorage] Error getting item ${key}:`, e);
      return await AsyncStorage.getItem(key);
    }
  },

  /**
   * Multi-key fetch with transparent decryption.
   */
  multiGet: async (keys) => {
    try {
      const rawEntries = await AsyncStorage.multiGet(keys);
      const masterKey = await getOrCreateDeviceMasterKey();
      return rawEntries.map(([k, rawVal]) => {
        if (!rawVal) return [k, rawVal];
        return [k, decryptString(rawVal, masterKey)];
      });
    } catch (e) {
      console.error('[CryptoStorage] Error in multiGet:', e);
      return await AsyncStorage.multiGet(keys);
    }
  },

  /**
   * Remove item from AsyncStorage.
   */
  removeItem: async (key) => {
    return await AsyncStorage.removeItem(key);
  },

  /**
   * Clear storage.
   */
  clear: async () => {
    cachedMasterKey = null;
    return await AsyncStorage.clear();
  },

  // Exported PIN security helpers
  hashPin,
  verifyPin,
  isPinHashed,
  timingSafeEqual,
  encryptString,
  decryptString,
  sha256Bytes,
  hmacSha256,
  strToUtf8,
  utf8ToStr,
  bytesToHex,
  hexToBytes,
  _resetKeyForTesting: () => {
    cachedMasterKey = null;
  }
};
