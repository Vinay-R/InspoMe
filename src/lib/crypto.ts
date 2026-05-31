import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// AES-GCM symmetric encryption for OAuth tokens at rest.
//
// Set TOKEN_ENCRYPTION_KEY to any string (we hash it to 32 bytes). If the env
// is absent we store plaintext with a sentinel prefix — fine for local dev
// against a fresh database, but production must set the key.
//
// Format: "v1:gcm:<iv-b64>:<authTag-b64>:<ciphertext-b64>" when encrypted,
//         "v0:plain:<plaintext>" when no key is configured.
//
// Rotation: bump the key, re-encrypt rows by reading + re-writing each token.
// We don't ship a rotation tool yet — note this when we ramp to other users.

const ALG = "aes-256-gcm";

function keyFromEnv(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  // Hash any-length input to a 32-byte key. Don't use as-is in case the user
  // sets a short or non-binary string.
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptToken(plaintext: string): string {
  const key = keyFromEnv();
  if (!key) return `v0:plain:${plaintext}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:gcm:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  if (stored.startsWith("v0:plain:")) return stored.slice("v0:plain:".length);
  if (stored.startsWith("v1:gcm:")) {
    const key = keyFromEnv();
    if (!key) {
      throw new Error("TOKEN_ENCRYPTION_KEY not set but encrypted token found.");
    }
    const [, , ivB64, tagB64, ctB64] = stored.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  }
  // Legacy/unrecognized — assume plaintext (safer than throwing for old rows).
  return stored;
}

export function isTokenEncryptionConfigured(): boolean {
  return keyFromEnv() !== null;
}
