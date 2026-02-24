/**
 * Encryption round-trip tests.
 * Verifies that data encrypted by Node can be decrypted back,
 * and that the binary layout matches the documented format:
 *   [salt (16)] [iv (12)] [authTag (16)] [ciphertext (...)]
 *
 * Run: npx tsx --test tests/encrypt.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encryptBuffer, decryptBuffer } from "../src/lib/encrypt.js";

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = SALT_LEN + IV_LEN + TAG_LEN; // 44

describe("encryptBuffer / decryptBuffer", () => {
  it("round-trips arbitrary binary data", () => {
    const password = "test-vault-password-2024";
    const original = Buffer.from("Hello, Payslip Vault!");

    const encrypted = encryptBuffer(original, password);
    const decrypted = decryptBuffer(encrypted, password);

    assert.deepStrictEqual(decrypted, original);
  });

  it("round-trips a large payload (simulating a PDF)", () => {
    const password = "strong-passphrase";
    const original = Buffer.alloc(50_000, 0xab);

    const encrypted = encryptBuffer(original, password);
    const decrypted = decryptBuffer(encrypted, password);

    assert.deepStrictEqual(decrypted, original);
  });

  it("round-trips a JSON string (simulating Turso payslip data)", () => {
    const password = "vault-secret-123";
    const payload = JSON.stringify({
      grossPay: 45000,
      netPay: 32000,
      paye: 8500,
      uif: 177.12,
    });
    const original = Buffer.from(payload, "utf-8");

    const encrypted = encryptBuffer(original, password);
    const decrypted = decryptBuffer(encrypted, password);

    assert.deepStrictEqual(decrypted, original);
    assert.deepStrictEqual(JSON.parse(decrypted.toString("utf-8")), JSON.parse(payload));
  });

  it("produces the correct binary layout", () => {
    const password = "layout-test";
    const original = Buffer.from("test");

    const encrypted = encryptBuffer(original, password);

    // Must be at least header + 1 byte of ciphertext
    assert.ok(encrypted.length > HEADER_LEN, `Expected > ${HEADER_LEN} bytes, got ${encrypted.length}`);

    // Ciphertext length should match original for GCM (no padding)
    const ciphertextLen = encrypted.length - HEADER_LEN;
    assert.strictEqual(ciphertextLen, original.length);
  });

  it("generates unique salt and IV per encryption", () => {
    const password = "unique-test";
    const original = Buffer.from("same data");

    const enc1 = encryptBuffer(original, password);
    const enc2 = encryptBuffer(original, password);

    const salt1 = enc1.subarray(0, SALT_LEN);
    const salt2 = enc2.subarray(0, SALT_LEN);
    const iv1 = enc1.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const iv2 = enc2.subarray(SALT_LEN, SALT_LEN + IV_LEN);

    assert.notDeepStrictEqual(salt1, salt2, "Salts should be unique");
    assert.notDeepStrictEqual(iv1, iv2, "IVs should be unique");
    // Entire ciphertext should differ due to different salt/iv
    assert.notDeepStrictEqual(enc1, enc2);
  });

  it("fails to decrypt with wrong password", () => {
    const original = Buffer.from("secret data");
    const encrypted = encryptBuffer(original, "correct-password");

    assert.throws(
      () => decryptBuffer(encrypted, "wrong-password"),
      { message: /Unsupported state|unable to authenticate/i }
    );
  });

  it("fails on tampered ciphertext (GCM integrity)", () => {
    const password = "integrity-test";
    const original = Buffer.from("do not tamper");
    const encrypted = encryptBuffer(original, password);

    // Flip a byte in the ciphertext region
    const tampered = Buffer.from(encrypted);
    tampered[HEADER_LEN] ^= 0xff;

    assert.throws(
      () => decryptBuffer(tampered, password),
      { message: /Unsupported state|unable to authenticate/i }
    );
  });

  it("handles empty plaintext", () => {
    const password = "empty-test";
    const original = Buffer.alloc(0);

    const encrypted = encryptBuffer(original, password);
    assert.strictEqual(encrypted.length, HEADER_LEN); // Header only, no ciphertext

    const decrypted = decryptBuffer(encrypted, password);
    assert.strictEqual(decrypted.length, 0);
  });
});

describe("cross-compatibility with browser format", () => {
  it("produces bytes that browser SubtleCrypto can rearrange", () => {
    // Verifies the layout that the browser decrypt.ts expects:
    // It reads [salt][iv][authTag][ciphertext] then rearranges to [ciphertext||authTag]
    const password = "cross-compat";
    const original = Buffer.from("browser test payload");

    const encrypted = encryptBuffer(original, password);
    const bytes = new Uint8Array(encrypted);

    const salt = bytes.slice(0, SALT_LEN);
    const iv = bytes.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const authTag = bytes.slice(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const ciphertext = bytes.slice(SALT_LEN + IV_LEN + TAG_LEN);

    assert.strictEqual(salt.length, SALT_LEN);
    assert.strictEqual(iv.length, IV_LEN);
    assert.strictEqual(authTag.length, TAG_LEN);
    assert.strictEqual(ciphertext.length, original.length);

    // Simulate browser rearrangement: [ciphertext || authTag]
    const rearranged = new Uint8Array(ciphertext.length + TAG_LEN);
    rearranged.set(ciphertext, 0);
    rearranged.set(authTag, ciphertext.length);

    assert.strictEqual(rearranged.length, original.length + TAG_LEN);
  });
});
