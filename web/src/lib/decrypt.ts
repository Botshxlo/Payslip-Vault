import { scrypt } from "scrypt-js";

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

// scrypt params matching Node.js scryptSync defaults
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password);
  const keyBytes = await scrypt(passwordBytes, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_LEN);

  return crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
}

/**
 * Decrypts an .enc buffer using the same format as src/lib/encrypt.ts:
 *   [salt (16)] [iv (12)] [authTag (16)] [ciphertext (...)]
 *
 * SubtleCrypto AES-GCM expects ciphertext || authTag concatenated,
 * so we rearrange the bytes before decrypting.
 */
export async function decryptBuffer(
  data: ArrayBuffer,
  password: string
): Promise<Uint8Array> {
  const bytes = new Uint8Array(data);

  const salt = bytes.slice(0, SALT_LEN);
  const iv = bytes.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const authTag = bytes.slice(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = bytes.slice(SALT_LEN + IV_LEN + TAG_LEN);

  // SubtleCrypto expects [ciphertext || authTag]
  const ciphertextWithTag = new Uint8Array(ciphertext.length + TAG_LEN);
  ciphertextWithTag.set(ciphertext, 0);
  ciphertextWithTag.set(authTag, ciphertext.length);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LEN * 8 },
    key,
    ciphertextWithTag
  );

  return new Uint8Array(decrypted);
}

/**
 * Decrypt a base64-encoded encrypted JSON string and parse it.
 * Used for payslip data stored in Turso.
 */
export async function decryptJson<T>(
  base64Data: string,
  password: string
): Promise<T> {
  // Decode base64 to ArrayBuffer
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decrypted = await decryptBuffer(bytes.buffer as ArrayBuffer, password);
  const jsonString = new TextDecoder().decode(decrypted);
  return JSON.parse(jsonString) as T;
}
